# Plano de implementação segura de RLS (TKT-026)

> **Status:** investigado e **planejado**, **não habilitado** ainda — habilitar RLS de
> forma ingênua neste código é **inseguro** (ver Achado abaixo). Este documento descreve o
> caminho seguro, verificável, para ligar RLS sem quebrar o app nem vazar entre tenants.

## Por que não foi simplesmente "ligado"

O isolamento multi-tenant hoje é **por convenção**: cada query usa `WHERE workspace_id = $1`.
Só o `admin_service` usa a GUC `app.workspace_id` via `scoped_conn`:

```rust
// admin_service.rs:44 — set_config com is_local = FALSE (nível de SESSÃO!)
sqlx::query("SELECT set_config('app.workspace_id', $1, false)")
```

### 🔴 Achado crítico — vazamento da GUC em conexões do pool
`set_config(..., false)` é **session-level**: o valor **persiste na conexão** depois que ela
volta para o pool. Hoje isso é inofensivo (só o `admin_service` lê a GUC, e sempre a re-seta).
**Mas se habilitarmos RLS** com políticas `USING (workspace_id = current_setting('app.workspace_id')::uuid)`:

- uma query **não-scoped** (chats/documents/projects, que usam `&state.db` direto) executada na
  **mesma conexão** logo após um request admin herdaria a GUC do workspace anterior → RLS
  filtraria pelo **workspace errado** → **quebra ou vazamento cruzado**.

Sem rodar o app inteiro (com tráfego concorrente reutilizando conexões do pool), **não há como
verificar** que isso não acontece. Por isso não foi mergeado.

## Caminho seguro (ordem importa)

### 1. Tornar a GUC transaction-local (pré-requisito)
Trocar o padrão por **transação + `SET LOCAL`** (reset automático no fim da transação — sem
vazamento entre requests):
```rust
let mut tx = pool.begin().await?;
sqlx::query("SELECT set_config('app.workspace_id', $1, true)")  // true = LOCAL à transação
    .bind(workspace_id.to_string()).execute(&mut *tx).await?;
// ... todas as queries do request nesta tx ...
tx.commit().await?;
```
Criar um helper único (ex.: `AppState::workspace_tx(workspace_id) -> Transaction`) e **rotear
todo acesso tenant por ele** (admin_service já está perto; chats/documents/projects/training
precisam migrar de `&state.db` para a transação scoped).

### 2. Migration de RLS (depois que (1) estiver em todo caminho tenant)
Para **cada** tabela tenant (`workspaces`-derivadas): `users, projects, project_members,
documents, document_chunks, chats, messages, training_interactions, webhooks, webhook_deliveries,
api_keys, usage_events, audit_logs, branding, onboarding_*, roles, …`:
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;  -- aplica até para o owner da tabela
CREATE POLICY tenant_isolation ON <t>
  USING       (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK  (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
```

> ⚠️ **Gotcha verificado:** use `NULLIF(..., '')`. Após um `RESET`, `current_setting('app.workspace_id', true)`
> retorna **`''`** (string vazia, **não** NULL), e `''::uuid` **dá erro** (não "0 linhas"). `NULLIF('','')`
> → NULL → `workspace_id = NULL` → false → 0 linhas, sem erro.
Tabelas filhas sem `workspace_id` (ex.: `messages` por `chat_id`): política via `EXISTS` no pai,
ou denormalizar `workspace_id`.

> **Estrita, não fall-open.** Como (1) garante que todo request tenant seta a GUC, a política
> pode ser estrita. Conexões sem GUC (migrations/serviços internos) usam um **role BYPASSRLS**
> dedicado, não a fall-open `IS NULL` (que enfraquece o isolamento).

### 3. Connection cleanup defensivo
No retorno da conexão ao pool (ou via `after_release` do `PgPoolOptions`), `RESET app.workspace_id`
como defesa em profundidade, mesmo com `SET LOCAL`.

## Verificação (end-to-end)
- **DB (✅ já provado neste ambiente, Postgres local):** com uma tabela `(workspace_id, val)`,
  RLS ligado, a política `NULLIF(...)` acima e um role **não-superuser** (`SET ROLE`):
  - `SET app.workspace_id='A'` → `SELECT` vê só linhas de A (**sem `WHERE`**); `='B'` → só B;
  - GUC nunca setado **e** após `RESET` → **0 linhas, sem erro**.
  - Isso valida a política e o isolamento estrito. (Superuser **bypassa** RLS — por isso o teste e
    o app precisam rodar como role comum; o `btv` local é superuser só p/ dev.)
- **App (precisa do app rodando):** sob carga concorrente, request do workspace B **nunca** vê
  dados de A mesmo reutilizando conexões do pool (valida o passo 1 — o ponto que não dá p/
  verificar offline).
- Suíte existente (`chats_test`, `rag_test`, `projects_test`) deve passar inalterada após a
  migração para transações scoped (são o regression gate).

## Por que isso é o certo
Ligar RLS sem o passo (1) **parece** "isolamento no banco" mas, com `set_config(false)` + pool,
introduz um vazamento cruzado intermitente — pior que o estado atual (convenção `WHERE`, que ao
menos é determinístico). O passo (1) é um refactor que **precisa** ser validado com o app rodando;
por integridade, não mergeio isolamento de dados que não consigo verificar.
