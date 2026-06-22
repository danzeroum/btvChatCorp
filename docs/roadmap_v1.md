# Roadmap de Execução v1 — BTV Chat Corp

> Log vivo da execução autônoma do **Plano de Implementação Unificado**
> (ver `docs/plano-implementacao-unificado.md`). Atualizado a cada PR.
>
> **Estratégia (decidida com o usuário):** execução autônoma sprint a sprint na branch
> `claude/optimistic-mendel-cwuuno`, com **auto-merge em `main` após verificação local**
> (`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `npm run build`), já que
> o CI não roda (P-09). App **tudo em Docker** (`docker compose up`) e arquitetado para
> escalar (Redis, RLS no banco, API stateless, profiles para vLLM/training/observability).
>
> **Decisões que dependem do usuário** ficam em `docs/pendencia.v1.md` (não bloqueiam o resto).
>
> ⚠️ **CI:** o GitHub Actions deste repo conclui todas as runs em *failure com 0 jobs*
> (falha de startup ambiental — ver P-09 em `pendencia.v1.md`). Como não há CI verde
> possível, cada PR é **verificado localmente** com os comandos do CI antes do merge.

## Legenda
✅ feito & mergeado · 🔄 em andamento · ⏳ a fazer · ⏸️ adiado (ver pendência) · ❌ bloqueado

## Rastreador de PRs
| PR | Escopo | Branch | Verificação local | Status |
|----|--------|--------|----|--------|
| #104 | Docs de rastreio + plano unificado | `claude/exec-plan-docs` | n/a (docs) | ✅ merged |
| #105 | Sprint 0: fix scripts + remover guards mortos | `claude/sprint0-scripts` | `bash -n`, `ng build` EXIT=0 | ✅ merged |
| #106 | TKT-016: persistir `audit_logs` (wire + INSERT) | `claude/audit-logs` | `clippy -D warnings`, 39/39 testes, 11 linhas gravadas | 🔄 aberto |

> Nota: o GitHub Actions não roda (P-09); "Verificação local" lista os comandos do CI
> executados nesta máquina (Postgres 16 local, `cargo test`, `clippy`, `ng build`).

## Status por Sprint / Ticket

### Sprint 0 — Estabilização do build
**Descoberta:** o `ng build` **passa hoje** (`EXIT_CODE=0`) porque onboarding e os guards
estão órfãos (fora do grafo de build). Logo, "frontend não compila" é latente — só quebra
ao wirar os órfãos. Separei os itens em "seguros" (PR #2) e "refactor" (PR dedicado).

| Ticket | Descrição | Status |
|---|---|---|
| TKT-001 | OnboardingService: `getState()` + `addUploadedDoc()` | ✅ feito — métodos add; `updateState` agora opera em `collectedData` |
| TKT-002 | Rota `/onboarding` em `app.routes.ts` | ✅ feito — wizard como shell + 7 steps filhos (ng build EXIT=0 com onboarding no grafo) |
| TKT-003 | `data-classification.guard` órfão + método inexistente | ✅ removido (PR #2) |
| TKT-004 | Deletar `role.guard.ts` duplicado/órfão | ✅ removido (PR #2) |
| TKT-005 | `APP_INITIALIZER` p/ `BrandingService` | ✅ feito — `initializeBranding` em `app.config.ts` |
| TKT-006 | Corrigir `start.sh`/`healthcheck.sh` | ✅ feito (PR #2) |
| TKT-007 | `seed-admin.sh` usar `$POSTGRES_USER`/`$POSTGRES_DB` | ✅ feito (PR #2) |

### Sprint 1 — Infra & Compliance
| Ticket | Descrição | Status |
|---|---|---|
| TKT-008 | Compose: `redis`/`reranker`/`mailpit` (+ `pgbouncer` no profile `scale`) | ✅ feito — serviços no compose; vLLM/training ficam em profile GPU (pendência) |
| TKT-009 | Unificar networks Docker | ✅ feito — rede gerenciada (bridge); dev overlay sem `rag-searcher` fantasma |
| TKT-010 | `QDRANT__SERVICE__API_KEY` no Qdrant | ✅ feito — Qdrant agora exige a key |
| TKT-011 | SSL/TLS no nginx + redirect + HSTS | ✅ feito — :443 TLS + 80→443 + HSTS; cert self-signed via `gen-env.sh` (ACME→pendência P-05) |
| TKT-014 | `proxy_buffering off` no SSE | ✅ feito — location dedicada `/api/v1/chat/stream` |
| TKT-015 | healthchecks | 🔄 redis/reranker/embedding/api/nginx ok; qdrant usa `service_started` (imagem sem curl) |
| TKT-016 | **Persistir `audit_logs`** | ✅ (PR #106) — middleware wired + INSERT, verificado (11 linhas em teste) |
| TKT-017 | Rate limiter → Redis | ✅ feito — throttle de login por IP em Redis (distribuído, scale-safe) + fallback em memória; `PerKeyRateLimiter` morto removido. Limiter do `api-public` (in-mem) fica p/ Sprint 5 (quando montado no `api`) |

### Sprint 2 — Núcleo de IA
| Ticket | Descrição | Status |
|---|---|---|
| TKT-018/019 | Linkar `ai-orchestrator` | ❌ **rejeitado** (investigação): o crate é dead code p/ outra arquitetura — **vLLM** (não Ollama), RAG `rag-searcher`, tabela `training_interactions`, SSE próprio, **sem basic-auth nem OLLAMA_MOCK**. Linká-lo **quebraria** o chat atual + 11 testes. O `api` já tem caminho LLM/RAG próprio (Ollama-compat + rerank). Stubs mortos `routes/chat.rs`/`feedback.rs` (importavam `ai_orchestrator`) removidos. |
| TKT-020 | crate `rag-searcher` (4 estágios) | ❌ **rejeitado** — é o RAG do `ai-orchestrator` (mesma arquitetura vLLM). O `api::rag` já tem 4 estágios com rerank (TKT-020-A). |
| TKT-020-A | Reranking (cross-encoder) no `rag.rs` | ✅ feito — chama o serviço `reranker` (:8003): over-fetch de candidatos → rerank → top_k; degradação graciosa (sem `RERANKER_URL`/erro mantém ordem vetorial); testes de reorder ✓ |
| TKT-020-B | "Bug" duplo-prefixo de embedding | ✅ **não era bug** — o serviço embeda os `texts` as-is; query usa `search_query:` (rag.rs) e doc usa `search_document:` (document-processor): convenção nomic-v2 **correta**. Apontamento da auditoria estava desatualizado. |
| TKT-021 | Divergência vLLM × Ollama | ✅ feito — ADR-001 atualizado: runtime = Ollama externo; vLLM/70B = profile de escala (GPU, P-06) |
| TKT-022 | Pipeline v2 do doc-processor (deletar ou wire) | ✅ feito — deletados `cleaner.rs`/`pipeline.rs`/`strategy_selector.rs` (fora do mod tree, zero refs); doc-processor builda |
| TKT-023 | service `training` no compose | ⏸️ profile GPU (P-06) |
| TKT-024 | `company_name` do DB | ⏸️ N/A no caminho vivo — o `// TODO` está no `ai-orchestrator` (morto, rejeitado). No `api` vivo, `branding.rs:142` usa "Empresa" só como **fallback** quando não há branding (aceitável). |
| Webhooks | Religar dispatcher (crate órfã → linkada) + dispatch nos eventos | ✅ feito — `api` linka o crate `webhooks`; `AppState.webhooks` (dispatcher); dispatch em `chat_created`/`chat_completed`/`document_uploaded`/`training_feedback`. **Teste e2e**: webhook inscrito recebe a entrega assinada (HMAC) ✓. Falta: `retry_webhook_delivery` (admin_service.rs:793) enfileirar no dispatcher |

### Sprint 3 — Multi-tenant & Auth
| Ticket | Descrição | Status |
|---|---|---|
| TKT-026 | **RLS no Postgres** | ⏳ |
| TKT-027 | `extractors.rs` ler `role_id` | ⏳ |
| TKT-028 | SSO OIDC | ⏸️ (client IDs/secrets→pendência) |
| TKT-029 | MFA TOTP | ⏳ (código; ativação→pendência) |
| TKT-030 | JWT httpOnly + CSRF | ⏳ |

### Sprint 4 — Frontend cleanup
| Ticket | Descrição | Status |
|---|---|---|
| TKT-032 | Deletar duplicatas / dead code | 🔄 parcial — removidos 5 arquivos de rota **mortos** no `api` (`usage`/`webhooks`/`search`/`chat`/`feedback.rs`, duplicatas órfãs das rotas reais do `api-public`). Dedup de componentes admin do frontend ainda pendente. |
| TKT-033/034 | Deletar duplicatas training + `chat.component` órfão | ⏳ |
| TKT-035 | Remover `MOCK_*` → estado honesto | ✅ feito — removidos os 24 refs `MOCK_*` (admin-dashboard, usage-overview, data-retention); dados fabricados (148 users, A100, R$2525…) → estados vazios/zerados honestos; `ng build` EXIT=0. (Banner de erro explícito = polish futuro) |
| TKT-036..040 | bulk suspend, OnPush, a11y, modelos, login | ⏳ |

### Sprint 5 — API pública & CD
| Ticket | Descrição | Status |
|---|---|---|
| TKT-041 | Swagger real | ✅ **já feito** — `ApiDoc` (utoipa) com 40+ paths / 25+ schemas + `SwaggerUi` em `/docs` (`routes/mod.rs`); apontamento da auditoria desatualizado |
| TKT-042 | usage com tokens reais | ✅ **já real** no caminho vivo — `admin_service.get_usage_metrics` soma `tokens_input/output` de `usage_events` (dashboard usa `/api/admin/metrics`, via `scoped_conn` com RLS). O `0 // TODO` estava no `api/routes/usage.rs` **morto** — arquivo deletado. (PR #113 editou esse arquivo morto; superado pela remoção.) |
| TKT-044 | `usage_tracker` middleware | ⏳ |
| TKT-043 | rotas documents/training na api-public | ⏳ |
| TKT-045/046 | CD (GHCR) + security scans | ⏳ |
| TKT-047/048 | WebSocket + e-mails (`lettre`) | ⏸️ (SMTP→pendência) |

### Sprint 6 — Polish & Scale
| Ticket | Descrição | Status |
|---|---|---|
| TKT-049..058 | ACME, backup, multi-stage, pin, runbooks, testes, perf, docs | ⏳ |
| Higiene | Remover stubs Python duplicados | ⏳ |

## Changelog de execução
- **Sprint 0 (auto-merge em `main`):** onboarding religado e `ng build` verde com a feature
  no grafo de build — `OnboardingService.getState()/addUploadedDoc()`, `updateState` operando
  em `collectedData`, rota `/onboarding` (wizard + 7 steps), `RouterOutlet` no wizard,
  `APP_INITIALIZER` do branding (TKT-001/002/005). Docker self-contained: rede `btv-prod-net`
  passou de externa → gerenciada (bridge) e corrigido bug de YAML em `OLLAMA_URL`
  (`docker compose config` válido). Novo `scripts/gen-env.sh` gera `.env` com segredos
  aleatórios para subir o stack com um comando.
