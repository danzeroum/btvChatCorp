# Auditoria de Migrations — Fase 2 (Consolidação)

> Status: **Inventário e decisão de política** — nenhuma migration é deletada por este documento.
> Data: 2026-05-30 · Escopo: consolidar os 3 diretórios de migrations divergentes em um único canônico.

## 1. Contexto

O repositório contém **três árvores de migrations independentes e divergentes** (não duplicadas). Antes de remover ou consolidar qualquer uma, este documento estabelece (a) qual é o diretório canônico e por quê, (b) o inventário completo, (c) a classificação de cada árvore órfã, e (d) os critérios de aceite para a consolidação efetiva — que deve ocorrer em PR separada, só após confirmação do histórico de deploy.

## 2. Qual é o canônico — e por quê

**`backend/migrations/` é o diretório canônico.** Evidência objetiva no código e na CI:

| Fonte | Referência |
|---|---|
| Runtime da API | `backend/crates/api/src/main.rs` → `sqlx::migrate!("../../migrations")` resolve para `backend/migrations/` |
| CI (job Backend) | `.github/workflows/ci.yml` → `sqlx migrate run --source migrations` com `working-directory: backend` |
| CI (Integration smoke) | idem `--source migrations` a partir de `backend/` |

Ou seja: **só `backend/migrations/` é efetivamente aplicado** pelo runtime e pela CI. As outras duas árvores não são referenciadas por nenhum código ou pipeline — são **órfãs do ponto de vista de execução**.

## 3. Inventário das 3 árvores

### 3.1 `backend/migrations/` — CANÔNICO (7 migrations)
| Arquivo | Tabelas / mudanças |
|---|---|
| `001_core.sql` | workspaces, users, projects, project_members, documents, project_documents, chats, messages, project_instructions, audit_logs |
| `002_rag_columns.sql` | document_chunks |
| `003_training_interactions.sql` | training_interactions, training_batches, training_documents |
| `004_branding_onboarding.sql` | workspace_brandings, onboarding_progress, workspace_invites |
| `005_document_chunks.sql` | índices de document_chunks |
| `006_training_interactions_orchestrator.sql` | **(novo)** colunas aditivas em training_interactions p/ ai-orchestrator |
| `007_webhooks.sql` | **(novo)** webhooks, webhook_deliveries |

### 3.2 `database/migrations/` — ÓRFÃ (5 migrations)
| Arquivo | Tabelas |
|---|---|
| `001_initial.sql` | workspaces, users, projects, **chat_sessions**, **chat_messages** |
| `002_training.sql` | training_interactions, training_batches, training_documents, **evaluation_benchmarks** |
| `003_api_webhooks.sql` | **api_keys**, **webhook_endpoints**, webhook_deliveries, **api_request_logs** |
| `004_sso_branding.sql` | **sso_configs**, workspace_brandings, audit_logs |
| `005_evaluation_benchmarks.sql` | evaluation_benchmarks, **workspace_ai_config** |

### 3.3 `backend/crates/api/migrations/` — ÓRFÃ (4 migrations)
| Arquivo | Tabelas |
|---|---|
| `0001_auth.sql` | workspaces, **roles**, users, **sessions**, audit_log |
| `0002_projects.sql` | projects, project_instructions, documents, project_documents |
| `0003_chats.sql` | chats, messages, **usage_metrics**, **daily_metrics**, **ai_models**, **lora_adapters**, training_batches, **rag_config**, api_keys, **webhooks**, webhook_deliveries, **resource_limits**, **retention_policies**, **deletion_requests**, **branding_config** |
| `0004_training.sql` | training_interactions, training_documents |

## 4. Comparação tabela-a-tabela (entidades sobrepostas)

Legenda: 🟢 idêntica · 🟡 derivada/compatível · 🔴 divergente (incompatível sem migração de dados)

### `workspaces` — 🔴 divergente
| Árvore | Identidade do tenant | Extras |
|---|---|---|
| backend | `slug` | sector, language, timezone |
| database | **`subdomain`** | status, settings (jsonb) |
| api | `slug` | session_timeout_minutes, max_concurrent_sessions, mfa_required, notify_on_*, notification_email, allow_user_self_registration |

→ `slug` vs `subdomain` é uma divergência de identidade; api carrega ~8 colunas de config de sessão/notificação ausentes no canônico.

### `users` — 🔴 divergente (3 modelos de authz)
| Árvore | Autorização | MFA / SSO |
|---|---|---|
| backend | `role` (texto), `is_active` | — |
| database | `role` + `status` | sso_provider, sso_subject, require_mfa |
| api | **`role_id` + `role_name`** + `status` | mfa_enabled, last_login_ip |

### `training_interactions` — 🟡 derivada/compatível (após migration 006)
- `database/migrations` já continha `rag_context`, `model_version`, `pii_detected`, `curator_notes`, `prompt_template_version`, `is_high_priority`, `training_batch_id`.
- A **migration 006** alinhou o canônico a esse superset (adicionando rag_context, pii_detected, model_version, project_id, prompt/completion_tokens, curator_notes, curator_priority).
- Divergência residual: canônico usa `curator_priority` (texto) onde `database` usa `is_high_priority` (bool). api adiciona `chat_id`/`updated_at`.

### `chats` — 🟢 idêntica (backend == api) / 🔴 vs database
- `backend/migrations.chats` e `api/migrations.chats` têm **lista de colunas idêntica** (id, workspace_id, project_id, title, summary, is_pinned, created_by, created_at, updated_at).
- `database/migrations` usa entidade diferente: **`chat_sessions`** (+ `chat_messages`), com `user_id` no lugar de `created_by` e sem `summary`/`is_pinned`.
- **Sinal forte**: o canônico foi derivado de `api/migrations` e evoluiu; `database` é uma linha de design paralela.

### webhooks — 🔴 divergente (3 variantes, nomes diferentes)
| Árvore | Tabela | Modelo |
|---|---|---|
| backend (007) | `webhooks` | mínimo: secret, events, status, timeout_secs, consecutive_failures |
| database | **`webhook_endpoints`** | + description, filters, delivery_config, last_delivery_* |
| api | `webhooks` | + retry_policy, timeout_ms, success_rate, total_deliveries, last_delivery_* |

## 5. Classificação das árvores órfãs

| Árvore | Natureza | Risco de deleção | Recomendação preliminar |
|---|---|---|---|
| `backend/crates/api/migrations/` | Iteração **anterior** do schema do próprio crate `api` (o `chats` idêntico indica que o canônico nasceu daqui). Contém tabelas ricas ainda não portadas (usage_metrics, ai_models, lora_adapters, rag_config, resource_limits, retention/deletion, branding_config). | **Médio** — não é aplicada por nenhum pipeline; mas tabelas úteis podem ser desejadas no canônico. | **Migrar features desejadas → canônico**, depois **remover**. Não é aplicada em runtime. |
| `database/migrations/` | Linha de design **paralela** (subdomain, SSO, evaluation_benchmarks, webhook_endpoints, workspace_ai_config, chat_sessions). Possivelmente aplicada a um banco gerenciado externo (ver §6). | **Alto** — schema incompatível (subdomain, role_id ausentes; nomes de tabela diferentes). Se um ambiente real a aplicou, é um banco vivo. | **NÃO remover** até confirmar deploy history. Tratar como histórico de um track separado. |

## 6. Verificação pendente — histórico de deploy (BLOQUEIA a consolidação)

A decisão final de **remover vs preservar** depende de responder:

1. **`database/migrations/` foi aplicada a algum ambiente real?** Há um **MCP Supabase conectado** a esta sessão — `list_migrations` / `list_tables` (read-only) revelariam se o schema vivo usa `subdomain`/`chat_sessions`/`webhook_endpoints` (→ é `database/migrations`) ou `slug`/`chats`/`webhooks` (→ é o canônico). **Requer sua autorização** para introspecção do projeto Supabase.
2. **`backend/crates/api/migrations/` já rodou em produção/staging** antes de o runtime apontar para `backend/migrations`? Se nunca, é seguro tratar como código morto.
3. Existem **dumps/backups** que dependam dos nomes de tabela órfãos (`chat_sessions`, `webhook_endpoints`)?

## 7. Plano da PR de consolidação (execução futura)

Pré-condição: respostas do §6 confirmando que as árvores órfãs **não** correspondem a um banco vivo divergente.

1. Portar para o canônico as features de `api/migrations` que se deseja manter (ex.: `ai_models`, `lora_adapters`, `rag_config`, `resource_limits`, retention/deletion) como novas migrations aditivas `008+`.
2. Decidir explicitamente sobre cada feature exclusiva de `database/migrations` (SSO, evaluation_benchmarks, workspace_ai_config) — portar ou descartar.
3. Remover `backend/crates/api/migrations/` e `database/migrations/`.
4. Adicionar `backend/migrations/README.md` declarando-o como única fonte canônica.

### Critérios de aceite
- [ ] `sqlx migrate run` aplica `001..N` em banco limpo (Postgres 16) sem erro.
- [ ] `cargo build --workspace` + `clippy --all-targets --all-features -D warnings` verdes (macros `query!` validam contra o schema consolidado).
- [ ] Nenhuma referência em código/CI a `database/migrations` ou `backend/crates/api/migrations`.
- [ ] `git grep -n "database/migrations\|crates/api/migrations"` retorna vazio.
- [ ] Histórico de deploy do §6 confirmado e registrado neste documento.

## 8. Decisão (TL;DR)

- **Canônico:** `backend/migrations/` (confirmado por runtime + CI).
- **Ação agora:** nenhuma deleção. Este inventário + política.
- **Bloqueio:** confirmar deploy history (§6), preferencialmente via introspecção read-only do Supabase, antes de qualquer remoção.
