# Plano de Implementação Unificado + Validação Cruzada — BTV Chat Corp

> **Data:** 2026-06-20 · **Branch:** `claude/optimistic-mendel-cwuuno`
> **Fonte:** fusão de duas auditorias técnicas independentes do repositório `danzeroum/btvChatCorp`.
> **Legenda de status:** ✅ REAL/funcional · ⚠️ PARCIAL · ❌ AUSENTE/órfão · 🔴 CRÍTICO/quebrado
> **Legenda de origem do ticket:** `[A]` achado da Auditoria A · `[B]` achado da Auditoria B · `[A+B]` ambos · `[✏️CORR]` corrigido pela validação cruzada

---

## 0. Como este documento foi construído

Foram cruzadas **duas auditorias independentes**:

- **Auditoria A** — foco na pergunta "o aplicativo faz o que promete em todas as etapas?". Metodologia: 3 agentes de exploração paralelos (backend / frontend / serviços periféricos) + verificação manual dos *seams* de integração (`Cargo.toml`, `api/src/rag.rs`, `docker-compose.yml`, fila de ingestão, serviço de embedding).
- **Auditoria B** — relatório técnico A–E + planilha (58 problemas) + plano de remediação com 58 tickets (`TKT-001..058`) em 7 sprints (92,5 PD ≈ 14 semanas), com cobertura forte de infraestrutura, compliance e dívida técnica.

Cada divergência entre as duas auditorias foi **resolvida lendo o código-fonte** e está documentada na Parte 4 (Validação Cruzada), com evidência `arquivo:linha`.

---

## 1. Sumário executivo

O `btvChatCorp` **não é um mockup**: há código real e, em vários subsistemas, de boa qualidade. Mas **não é comercializável hoje**. O padrão dominante é uma *camada externa* robusta (branding, webhooks, onboarding backend, pipeline de documentos simples) sobre um *núcleo de IA/RAG/orquestração* que **existe no código mas está desconectado do runtime**.

Três problemas estruturais (consenso das duas auditorias):

1. **Divergência código ↔ promessa.** ADRs e README descrevem vLLM + Llama 70B + LoRA + RAG com reranker; o runtime usa Ollama `llama3.2:3b` e um RAG de 2 estágios. Dois crates inteiros (`ai-orchestrator`, `rag-searcher`) estão implementados mas **não linkados** ao binário `api`.
2. **Infraestrutura de produção quebrada.** `docker-compose.yml` não tem `redis`/`vllm`/`reranker`/`training`; `scripts/start.sh` sobe serviços inexistentes; `nginx.conf` não tem SSL.
3. **Dívida técnica difusa.** ~3.300+ linhas de componentes Angular duplicados; frontend que **não type-checa**; `MOCK_*` exibido como dado real no admin; `audit_logs` que nunca persiste.

**Veredito:** com ~7 sprints focados é possível chegar a um produto enterprise defensável — porque **a base existe**; o trabalho é *concluir o que foi começado e remover o que é fachada*.

---

## 2. Tabela de aderência consolidada (já corrigida pela validação cruzada)

| # | Promessa do projeto | Status | Nota de fusão (A + B) |
|---|---|---|---|
| 1 | White-label / branding | ✅ REAL | CSS dinâmico por workspace, sanitizado anti-XSS, custom domains, servido por subdomínio. A e B concordam. |
| 2 | Webhooks (HMAC, retry, dispatch) | ⚠️ ÓRFÃO | Signer/dispatcher/retry reais, mas o `api` **não depende do crate** e nunca dispara eventos. |
| 3 | Onboarding (backend) | ✅ REAL | `provisioner`/`checklist` persistem estado e leem counts reais do DB. |
| 4 | Onboarding (frontend) | 🔴 QUEBRADO | Sem rota `/onboarding`; `OnboardingService` sem métodos chamados pelos steps → **não compila**. |
| 5 | Document processor (deployado) | ✅ REAL | Binário `rag-worker`: extract (pdf/docx) → chunk → embed → indexa Qdrant + Postgres. |
| 6 | Document processor (pipeline "v2") | ❌ MORTO | `cleaner.rs`/`pipeline.rs`/`strategy_selector.rs` órfãos (fora do `mod` tree). |
| 7 | RAG via Qdrant | ⚠️ PARCIAL | Runtime usa `api/src/rag.rs` (2 estágios). Crate `rag-searcher` (4 estágios) é órfão. |
| 8 | Reranking (CrossEncoder) | ⚠️ NÃO USADO | Modelo carregado no serviço `embedding` (`/rerank`), mas o chat **nunca chama**. |
| 9 | Orquestração LLM | ⚠️ ÓRFÃO | `ai-orchestrator` é lib não linkada; chat fala Ollama inline em `chats.rs`. |
| 10 | vLLM + Llama 3.3 70B + LoRA | ❌ DIVERGENTE | ADR-001/005 declaram; compose usa Ollama `llama3.2:3b`. |
| 11 | Multi-tenancy | ⚠️ POR CONVENÇÃO | **Sem RLS real** no Postgres; `set_config` só no `admin_service`, `WHERE $1` manual no resto. |
| 12 | SSO (OIDC/SAML/LDAP) | ❌ AUSENTE | Só UI + ADR "pendente". Zero backend (grep sem match em `backend/`). |
| 13 | API pública OpenAI-compat | ❌ ÓRFÃ | Crate não buildado (`Dockerfile` só `-p api`); fora do compose; rotas não montadas. |
| 14 | Audit logging | ❌ NÃO PERSISTE | Middleware só faz `tracing`; tabela `audit_logs` nunca escrita. |
| 15 | Usage / billing | ❌ ZEROS/MOCK | Backend retorna `0 // TODO`; frontend mostra `MOCK_*`. |
| 16 | MFA | ❌ AUSENTE | Coluna `mfa_enabled` existe; nenhum código de 2º fator. |
| 17 | Infra de produção (compose/nginx/start.sh) | 🔴 QUEBRADA | start.sh chama serviços inexistentes; nginx sem SSL. |
| 18 | Auth JWT / Chat SSE / Upload / wiring do frontend | ✅ REAL | Confirmado por A (exceto os erros de type-check do onboarding). |

**Placar honesto:** o **núcleo** (auth JWT, chat com SSE, ingestão de documentos, branding) funciona de verdade. A maior parte da **camada "enterprise"** (SSO, API pública, webhooks, reranking, audit, vLLM, RLS, MFA) é órfã, stub ou só-UI.

---

## 3. Plano de implementação unificado (7 sprints)

Adota-se o scaffold de 7 sprints da Auditoria B (sólido e detalhado), **injetando** os achados exclusivos da Auditoria A e **corrigindo** os tickets que a validação derrubou.

### Sprint 0 — Estabilização do build (Semana 1 · ~3 PD)
**Objetivo:** o projeto compila (`cargo build` + `ng build`) e os scripts não referenciam serviços fantasma.

| Ticket | Origem | Ação |
|---|---|---|
| TKT-001 | [B] | `OnboardingService`: adicionar `getState()` e `addUploadedDoc()` (confirmado: faltam). |
| TKT-002 | [B] | Adicionar rota `/onboarding` (com children dos 7 steps) em `app.routes.ts`. |
| TKT-003 | [B] | `data-classification.guard.ts` chama `AuthService.getUserClearanceLevel()` inexistente → implementar ou remover o guard. |
| TKT-004 | [B] | Deletar `core/guards/role.guard.ts` (`authGuard` duplicado vs `features/auth/auth.guard.ts`). |
| TKT-005 | [B] | `APP_INITIALIZER` para `BrandingService.initialize()` em `app.config.ts`. |
| TKT-006 | [B][✏️CORR] | Corrigir `scripts/start.sh`/`healthcheck.sh`: hoje sobem `redis`, `vllm`, `rag-searcher`, `training` que **não existem no compose** (`start.sh:30,36,42`). **Correção da validação:** `rag-searcher`/`ai-orchestrator` são **bibliotecas, não serviços** — remover do script e linká-los no `api` (Sprint 2). |
| TKT-007 | [B] | `seed-admin.sh`: usar `$POSTGRES_USER`/`$POSTGRES_DB` (hoje hardcoded `btvchat`). |

**Critério de aceite:** `ng build` passa (hoje quebra no type-check do onboarding); `cargo build --workspace` passa.

### Sprint 1 — Infra & Compliance (Semana 2-3 · ~13 PD)
**Objetivo:** stack de produção sobe, HTTPS ativo, audit log persistindo.

| Ticket | Origem | Ação |
|---|---|---|
| TKT-008 | [B][✏️CORR] | Adicionar ao compose só o que é **serviço**: `redis`, `vllm` (ou assumir Ollama, ver TKT-021), `reranker` (**ou** reusar `/rerank` do `embedding`, ver TKT-020-A). **Remover `rag-searcher` da lista** (é lib). O stub deployável é `backend/services/rag_searcher` (binário-stub). |
| TKT-009 | [B] | Unificar networks Docker divergentes (`btv-prod-net` vs `btv-net`). |
| TKT-010 | [B] | `QDRANT__SERVICE__API_KEY` no Qdrant (hoje `api` envia key, Qdrant não exige). |
| TKT-011 | [B] | SSL/TLS no `nginx.conf` (confirmado: só `listen 80`) + redirect 80→443 + HSTS + HTTP/2. |
| TKT-012/013/014/015 | [B] | Sync do cert exigido por `start.sh`; `proxy_buffering off` nas rotas SSE; healthchecks faltantes; documentar a rede externa no README. |
| TKT-016 | [A+B] | **Persistir `audit_logs`**: injetar `PgPool` no middleware e `INSERT` em `tokio::spawn`. Destrava compliance LGPD/SOC2. |
| TKT-017 | [B] | Rate limiter → Redis (`INCR`+`EXPIRE`); hoje `HashMap` in-memory, não distribuído. |

### Sprint 2 — Religar o núcleo de IA (Semana 4-5 · ~13 PD)
**Objetivo:** cumprir a promessa central (RAG com reranker + orquestrador wired).

| Ticket | Origem | Ação |
|---|---|---|
| TKT-018 | [A+B] | Adicionar `ai-orchestrator` como dep de `api/Cargo.toml` + campos no `AppState`. *(Evidência A: hoje `api` só depende de `branding`+`onboarding`; prod `Dockerfile` builda só `-p api`.)* |
| TKT-019 | [A+B] | Declarar `pub mod chat/search/feedback` em `routes/mod.rs` e migrar `chats.rs` para o `chat_handler`. |
| TKT-020 | [A+B] | Substituir `api/src/rag.rs` (2 estágios) pelo crate `rag-searcher` (4 estágios: embed → Qdrant → rerank → context-expansion + dedup). |
| **TKT-020-A** | **[A] NOVO** | **Quick-win de reranking:** o serviço `embedding` JÁ expõe `/rerank` (CrossEncoder carregado). Apontar `RERANKER_URL=http://embedding:8001` e chamar rerank no `rag.rs` **antes** de migrar para o crate completo. Custo baixo, ganho imediato. |
| **TKT-020-B** | **[A] NOVO — BUG** | **Corrigir duplo-prefixo de embedding:** `rag.rs:21` envia `"search_query: "` sem `mode`; o serviço usa default `mode="document"` e prefixa `"search_document: "` → vira `"search_document: search_query: <q>"` (prefixo errado para o Nomic; degrada recall). Enviar `mode:"query"`. |
| TKT-021 | [B] | Resolver divergência ADR-001 (vLLM/70B) vs runtime (Ollama/3b): decidir e alinhar ADR + compose. |
| TKT-022 | [B][✏️CORR] | Pipeline avançado do `document-processor`: **reframe** — `cleaner/pipeline/strategy_selector.rs` **não quebram o build** (estão fora do `mod` tree); são **código morto**. Decisão: deletar **ou** declarar os mods + adicionar `whatlang`/`unicode-normalization` ao Cargo.toml. |
| TKT-023/024 | [B] | Service `training` no compose com cron; `company_name` do DB (hoje hardcoded `"Empresa"` em `chat_handler.rs:114`). |

### Sprint 3 — Multi-tenant hardening & Auth (Semana 6-7 · ~21 PD)
**Objetivo:** isolamento garantido pelo banco + auth enterprise.

| Ticket | Origem | Ação |
|---|---|---|
| TKT-026 | [A+B] | **Habilitar RLS no Postgres**: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY USING (workspace_id = current_setting('app.workspace_id')::uuid)` + `SET LOCAL` por transação. *(Evidência A: hoje `set_config` só em `admin_service.rs:49`; chat/docs usam `WHERE $1` manual → isolamento por convenção.)* |
| TKT-027 | [B] | `extractors.rs` ler `users.role_id` (migration 013) em vez de permissões hardcoded por string de role. |
| TKT-028/029/030 | [B] | SSO OIDC (Google/Microsoft) com `openidconnect`; MFA TOTP (`totp-rs`); JWT em cookie `httpOnly` + CSRF. |

### Sprint 4 — Frontend cleanup & UX (Semana 8-9 · ~10 PD)
| Ticket | Origem | Ação |
|---|---|---|
| TKT-032 | [A+B] | Deletar 10+ pares de componentes duplicados no admin (~3.300 linhas mortas). |
| TKT-033/034 | [B] | Deletar duplicatas em `training-dashboard/` e `chat.component.ts` órfão (manter `chat-container`). |
| TKT-035 | [A+B] | Remover `MOCK_*` (24 referências) de dashboard/billing/compliance → banner de erro explícito. |
| TKT-036..040 | [B] | Bulk "Suspender" real; `OnPush` em componentes pesados; `aria-label`; unificar modelos duplicados; login via `AuthService`. |

### Sprint 5 — API pública & CD (Semana 10-11 · ~23 PD)
| Ticket | Origem | Ação |
|---|---|---|
| TKT-041 | [A+B] | Swagger real (`openapi.rs` hoje retorna router vazio). |
| TKT-042/044 | [A+B] | `usage_tracker` com persistência real + endpoint `/usage` agregado (hoje `total_tokens=0 // TODO`). |
| TKT-043 | [B] | Descomentar rotas `documents`/`training` da `api-public` (`TODO(C2-writes)`). |
| TKT-045/046 | [B] | CD (GHCR + deploy) + security scans (trivy/cargo-audit/npm-audit/gitleaks). |
| TKT-047/048 | [B] | WebSocket bidirecional; e-mails de invite via `lettre` (resolve `admin_service.rs:328`). |
| — | [A] | **Decisão arquitetural:** `api-public` é órfã — escolher (a) deployar como serviço próprio (Dockerfile + compose) ou (b) montar suas rotas dentro do `api`. Hoje é inalcançável. |

### Sprint 6 — Polish & Scale (Semana 12-14 · ~12 PD)
| Ticket | Origem | Ação |
|---|---|---|
| TKT-049..058 | [B] | ACME custom domains; backup/restore; multi-stage Python; pin de imagens por digest; runbooks; testes frontend 60%; perf audit; docs do portal público. |
| — | [A] | **Higiene:** remover stubs Python duplicados `backend/services/rag_searcher` e `backend/services/document_processor` (ambos só `TODO`; os reais são os crates Rust). |

---

## 4. Quick wins (crítico × baixo esforço — fazer primeiro)

1. **Persistir `audit_logs`** (TKT-016) — destrava compliance, ~1-2 PD.
2. **Religar webhooks** — instanciar o dispatcher + `dispatch()` nos eventos (preenche `admin_service.rs:793`); o crate já está pronto.
3. **Reranking via `/rerank` do embedding** (TKT-020-A) + **fix do duplo-prefixo** (TKT-020-B) — ganho de qualidade de retrieval por custo baixíssimo.
4. **Fix do build frontend** (TKT-001..005) — sem isso, o onboarding inteiro não roda.
5. **Alinhar docs/ADR com a realidade** (vLLM↔Ollama; SSO "pendente") — honestidade imediata, evita vender o que não existe.

---

## 5. VALIDAÇÃO CRUZADA (o pedido "no final": validar B e revalidar A)

### 5A. Onde A e B concordam (alta confiança — confirmado no código)
Crates órfãos (`ai-orchestrator`, `rag-searcher`, `api-public`); `api/Cargo.toml` depende só de `branding`+`onboarding`; `audit_logs` não persiste; `MOCK_*` no admin; SSO ausente; webhooks não disparados; RAG runtime simplificado; usage zerado; `openapi.rs` vazio; divergência ADR↔runtime. **Todos verificados ✓.**

### 5B. Revalidação de A — onde EU (Auditoria A) estava impreciso/errado

| Meu apontamento original | Correção após reler o código | Evidência |
|---|---|---|
| "Multi-tenancy **REAL com RLS** via `current_setting`" | ❌ **Impreciso.** Não existe RLS (nenhum `CREATE POLICY`/`ENABLE ROW LEVEL SECURITY` nas migrations). Há `set_config` **só** no `admin_service`; rotas de chat/docs usam `WHERE workspace_id = $1` manual → isolamento **por convenção**. Aqui **B está mais certo**. | migrations sem RLS; `admin_service.rs:49` |
| Frontend "REAL" (onboarding incluído) | ❌ **Incompleto.** O backend de onboarding é real, mas o **frontend não type-checa** (métodos e rota faltando). Meus agentes checaram wiring de API, não a compilação. | `onboarding.service.ts`; `app.routes.ts` |
| (Infra não foi coberta por A) | ➕ **Lacuna preenchida por B** e aceita: nginx sem SSL, `start.sh` quebrado, compose incompleto. | `nginx.conf:22`; `start.sh:30,36,42` |

### 5C. Validação de B — onde o OUTRO analista exagerou ou errou

| Apontamento de B | Veredito | Evidência |
|---|---|---|
| "`document-processor`: `pipeline.rs`/`cleaner.rs`/`strategy_selector.rs` **não compiláveis → quebram o build**" | ⚠️ **Exagerado.** Eles importam `whatlang`/`unicode_normalization` (ausentes do Cargo.toml), MAS estão **fora do `mod` tree** (nem `main.rs` nem `lib.rs` os declaram) → **não são compilados → não quebram `cargo build`**. São código morto, não build-blocker. | `lib.rs`/`main.rs` (mods); `Dockerfile --bin rag-worker` |
| "Adicionar `rag-searcher` ao docker-compose" (TKT-008 / `start.sh`) | ❌ **Errado.** `rag-searcher` e `ai-orchestrator` são **bibliotecas** (sem `[[bin]]`); não sobem como serviço. O correto é linká-las no `api` — o que os próprios TKT-018/020 de B fazem (inconsistência interna no plano dele). | `rag-searcher/Cargo.toml` (sem `[[bin]]`) |
| "Reranker **totalmente ausente** do stack" | ⚠️ **Impreciso.** O serviço `embedding` (deployado) carrega o CrossEncoder e expõe `/rerank` em `:8001`. O problema real é o chat **não chamar**, não a ausência do modelo. | `services/embedding/app/main.py:42,73` |
| Aderência geral, divergência ADR↔runtime, dívida técnica, RLS, infra (SSL/compose/scripts) | ✅ **Confirmado.** Pontos fortes e corretos de B — inclusive me corrigiram no RLS. | ADR-001; `nginx.conf`; `start.sh` |

### 5D. Precisão que A adiciona a B
- **Prova exata da orfandade:** o `Dockerfile` de produção builda só `-p api` → os crates órfãos nem compilam em produção.
- **Bug concreto:** duplo-prefixo de embedding (`rag.rs:21` × default `mode="document"`).
- **Quick-win destravado:** o `embedding` já serve `/rerank` → dá para ativar reranking sem subir um serviço novo.

---

## 6. Verificação (como testar o plano end-to-end)

- **Build (regressão do Sprint 0):** `cd backend && cargo build --workspace` (deve passar hoje) · `cd frontend && npm run build` (deve **falhar** hoje no onboarding).
- **Infra (após Sprint 1):** `docker compose up -d` sobe tudo; `./scripts/start.sh` roda sem `no such service`; `https://` responde.
- **IA (após Sprint 2):** upload de documento → chunk → embed → index → chat com reranker; conferir pontos no Qdrant (`/collections/workspace_.../points`).
- **Tenancy (após Sprint 3):** tentar acessar recurso de outro workspace deve falhar **pelo banco (RLS)**, não só pelo `WHERE`.
- **Compliance (após TKT-016):** gerar um evento e confirmar a linha gravada em `audit_logs`.

---

*Documento gerado pela fusão das Auditorias A e B, com cada divergência resolvida por leitura direta do código-fonte.*
