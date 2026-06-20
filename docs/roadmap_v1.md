# Roadmap de Execução v1 — BTV Chat Corp

> Log vivo da execução autônoma do **Plano de Implementação Unificado**
> (ver `docs/plano-implementacao-unificado.md`). Atualizado a cada PR.
>
> **Estratégia:** PRs focados por tema → `main`. Cada PR é verificado localmente
> (`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `npm run build`)
> antes do push, e só é mergeado com o CI verde.
>
> **Decisões que dependem do usuário** ficam em `docs/pendencia.v1.md` (não bloqueiam o resto).
>
> ⚠️ **CI:** o GitHub Actions deste repo conclui todas as runs em *failure com 0 jobs*
> (falha de startup ambiental — ver P-09 em `pendencia.v1.md`). Como não há CI verde
> possível, cada PR é **verificado localmente** com os comandos do CI antes do merge.

## Legenda
✅ feito & mergeado · 🔄 em andamento · ⏳ a fazer · ⏸️ adiado (ver pendência) · ❌ bloqueado

## Rastreador de PRs
| PR | Escopo | Branch | CI | Status |
|----|--------|--------|----|--------|
| #104 | Docs de rastreio + plano unificado | `claude/exec-plan-docs` | 🔄 | aberto |
| #2 | Sprint 0: fix scripts + remover guards mortos | `claude/sprint0-scripts` | — | preparando |

## Status por Sprint / Ticket

### Sprint 0 — Estabilização do build
**Descoberta:** o `ng build` **passa hoje** (`EXIT_CODE=0`) porque onboarding e os guards
estão órfãos (fora do grafo de build). Logo, "frontend não compila" é latente — só quebra
ao wirar os órfãos. Separei os itens em "seguros" (PR #2) e "refactor" (PR dedicado).

| Ticket | Descrição | Status |
|---|---|---|
| TKT-001 | OnboardingService: `getState()` + `addUploadedDoc()` | ⏳ (PR onboarding; exige unificar os 2 `OnboardingState`) |
| TKT-002 | Rota `/onboarding` em `app.routes.ts` | ⏳ (PR onboarding; só depois de TKT-001+039) |
| TKT-003 | `data-classification.guard` órfão + método inexistente | ✅ removido (PR #2) |
| TKT-004 | Deletar `role.guard.ts` duplicado/órfão | ✅ removido (PR #2) |
| TKT-005 | `APP_INITIALIZER` p/ `BrandingService` | ⏳ (PR onboarding/branding) |
| TKT-006 | Corrigir `start.sh`/`healthcheck.sh` | ✅ feito (PR #2) |
| TKT-007 | `seed-admin.sh` usar `$POSTGRES_USER`/`$POSTGRES_DB` | ✅ feito (PR #2) |

### Sprint 1 — Infra & Compliance
| Ticket | Descrição | Status |
|---|---|---|
| TKT-008 | Compose: `redis`/`vllm`/`reranker` (rag-searcher é lib, não entra) | ⏸️ (vLLM→pendência) |
| TKT-009 | Unificar networks Docker | ⏳ |
| TKT-010 | `QDRANT__SERVICE__API_KEY` no Qdrant | ⏳ |
| TKT-011 | SSL/TLS no nginx + redirect + HSTS | ⏸️ (cert/domínio→pendência) |
| TKT-012..015 | cert sync, SSE buffering, healthchecks, doc rede | ⏳ |
| TKT-016 | **Persistir `audit_logs`** | ⏳ |
| TKT-017 | Rate limiter → Redis | ⏸️ (depende de redis no compose) |

### Sprint 2 — Núcleo de IA
| Ticket | Descrição | Status |
|---|---|---|
| TKT-018/019 | Linkar `ai-orchestrator` + montar rotas | ⏳ |
| TKT-020 | Trocar `rag.rs` pelo crate `rag-searcher` | ⏳ |
| TKT-020-A | Reranking via `/rerank` do embedding (quick-win) | ⏳ |
| TKT-020-B | **Bug:** duplo-prefixo de embedding em `rag.rs` | ⏳ |
| TKT-021 | Divergência vLLM × Ollama | ⏸️ (decisão→pendência) |
| TKT-022 | Pipeline v2 do doc-processor (deletar ou wire) | ⏳ |
| TKT-023/024 | service `training` no compose; `company_name` do DB | ⏳ |

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
| TKT-032 | Deletar duplicatas do admin | ⏳ |
| TKT-033/034 | Deletar duplicatas training + `chat.component` órfão | ⏳ |
| TKT-035 | Remover `MOCK_*` → banner de erro | ⏳ |
| TKT-036..040 | bulk suspend, OnPush, a11y, modelos, login | ⏳ |

### Sprint 5 — API pública & CD
| Ticket | Descrição | Status |
|---|---|---|
| TKT-041 | Swagger real | ⏳ |
| TKT-042/044 | usage_tracker + `/usage` | ⏳ |
| TKT-043 | rotas documents/training na api-public | ⏳ |
| TKT-045/046 | CD (GHCR) + security scans | ⏳ |
| TKT-047/048 | WebSocket + e-mails (`lettre`) | ⏸️ (SMTP→pendência) |

### Sprint 6 — Polish & Scale
| Ticket | Descrição | Status |
|---|---|---|
| TKT-049..058 | ACME, backup, multi-stage, pin, runbooks, testes, perf, docs | ⏳ |
| Higiene | Remover stubs Python duplicados | ⏳ |

## Changelog de execução
- _(em branco — primeira entrada abaixo ao abrir o PR #1)_
