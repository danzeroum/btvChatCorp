# Sprint 4 — Produto e Mercado
**Status:** 🟡 Em andamento  
**Início:** após tag `v0.1.0` (conclusão Sprint 3)  
**Pré-requisito:** Sprints 1–3 concluídas

---

## Épico
- Issue: [#44](https://github.com/danzeroum/btvChatCorp/issues/44)

---

## Issues por Grupo

### Grupo A — White-label como Produto
| Issue | Tarefa | Status |
|---|---|---|
| [#45](https://github.com/danzeroum/btvChatCorp/issues/45) | P1: White-label produto de parceiros + `/partner/signup` | 🔴 Pendente |

### Grupo B — BTV Gateway
| Issue | Tarefa | Status |
|---|---|---|
| [#50](https://github.com/danzeroum/btvChatCorp/issues/50) | P2: BTV Gateway OpenAI-compatible + BYOK + `api.btvc.com` | 🔴 Pendente |
| [#51](https://github.com/danzeroum/btvChatCorp/issues/51) | P3: Swagger API pública + Postman + exemplos SDK | 🔴 Pendente |

### Grupo C — Portal de Parceiros
| Issue | Tarefa | Status |
|---|---|---|
| [#52](https://github.com/danzeroum/btvChatCorp/issues/52) | P4: Portal de parceiros MVP (wildcard TLS + faturamento manual) | 🔴 Pendente |

### Grupo D — Marketing
| Issue | Tarefa | Status |
|---|---|---|
| [#53](https://github.com/danzeroum/btvChatCorp/issues/53) | Marketing: landing page + one-pager + deck de vendas | 🔴 Pendente |

---

## PRs

| PR | Branch | Issues | Merge order |
|---|---|---|---|
| (a criar) | `feat/s4-white-label` | #45, #52 | 1º |
| (a criar) | `feat/s4-gateway` | #50, #51 | 2º |
| (a criar) | `feat/s4-marketing` | #53 | 3º |

---

## Critérios de Aceitação

- [ ] Programa de parceiros documentado em `docs/parceiros/`
- [ ] `POST /partner/signup` funcional
- [ ] `api.btvc.com` acessível com autenticação por API key
- [ ] SDK Python `openai` funciona apontando para BTV Gateway
- [ ] Swagger UI em `api.btvc.com/docs`
- [ ] Postman collection em `docs/api/btv-gateway.postman.json`
- [ ] 1 parceiro piloto com workspace white-label ativo
- [ ] Landing page publicada + one-pager + deck prontos

---

## Backlog Sprint 5

| Prioridade | Tarefa |
|---|---|
| 🔴 ALTA | Multi-tenancy: PostgreSQL schemas isolados por workspace |
| 🔴 ALTA | SSO (SAML/OIDC) para enterprise |
| 🟠 MÉDIA | Gateway de pagamento (Stripe/Iugu) — automatizar faturamento |
| 🟠 MÉDIA | Onboarding wizard 5 steps no frontend |
| 🟡 BAIXA | Dashboard analytics com métricas por setor |
| 🟡 BAIXA | Fine-tuning LoRA: pipeline human-in-the-loop |

---

*Gerado automaticamente em 2026-05-19*  
*Ref: btvChatCorp_Validacao_Cruzada_Sprints.pdf — Seção 4.5*
