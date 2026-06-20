# Pendências para o usuário — BTV Chat Corp (v1)

> Itens que **exigem sua decisão, credencial ou infraestrutura** e por isso não posso
> concluir sozinho. Cada um está **anotado e pulado** — sigo executando o resto do plano.
> Quando você responder, eu retomo o item correspondente.

## 🔧 Decisões de arquitetura
| # | Pendência | Contexto | Opções |
|---|---|---|---|
| P-01 | **vLLM vs Ollama** (TKT-021) | ADR-001/005 dizem vLLM + Llama 3.3 70B; o runtime usa Ollama `llama3.2:3b`. | (a) Adotar vLLM (exige 2×H100/GPU) e atualizar compose; (b) Assumir Ollama e reescrever ADR-001/005/007. **Sem resposta, sigo com Ollama e alinho os ADRs.** |
| P-02 | **api-public: serviço próprio ou rotas no `api`?** | Crate OpenAI-compat órfã. | (a) Deployar como serviço separado (Dockerfile+compose); (b) Montar rotas dentro do `api`. **Recomendo (b).** |

## 🔑 Credenciais / segredos (não tenho como gerar)
| # | Pendência | Necessário para |
|---|---|---|
| P-03 | **OAuth client ID + secret (Google e/ou Microsoft)** | SSO OIDC (TKT-028). Vou deixar o código pronto, mas só ativa com os segredos no `.env`. |
| P-04 | **Credenciais SMTP** (host, user, pass, from) | E-mails de convite via `lettre` (TKT-048). Código fica pronto; envio real exige SMTP. |
| P-05 | **Domínio real + certificado TLS** (ou aceitar self-signed) | SSL no nginx (TKT-011) e ACME/Let's Encrypt p/ custom domains (TKT-049). |

## 🖥️ Infraestrutura / ambiente
| # | Pendência | Contexto |
|---|---|---|
| P-06 | **GPU disponível?** | Necessária p/ vLLM (P-01) e p/ fine-tuning real (`training`). Sem GPU, mantenho `TRAINING_MOCK`/Ollama. |
| P-07 | **Redis: provisionar?** | Rate limiter distribuído (TKT-017) e pub/sub do WebSocket (TKT-047) dependem de Redis. Vou adicionar ao compose; confirme se o ambiente de produção comporta. |
| P-08 | **Secrets do GitHub Actions p/ CD** (registry/deploy) | CD para GHCR + deploy (TKT-045) precisa de `GHCR_TOKEN`/chaves SSH ou kubeconfig. |

## ✅ Como isso é tratado
- Itens acima estão **adiados** (⏸️ no `roadmap_v1.md`), não bloqueados: para cada um, deixo
  o **código/scaffold pronto** quando possível e marco o ponto exato que falta credencial/decisão.
- O resto do plano (que não depende de você) é executado e mergeado normalmente.
