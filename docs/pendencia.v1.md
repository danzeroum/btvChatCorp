# Pendências para o usuário — BTV Chat Corp (v1)

> Itens que **exigem sua decisão, credencial ou infraestrutura** e por isso não posso
> concluir sozinho. Cada um está **anotado e pulado** — sigo executando o resto do plano.
> Quando você responder, eu retomo o item correspondente.

## 🔧 Decisões de arquitetura
| # | Pendência | Contexto | Opções |
|---|---|---|---|
| P-01 | ✅ **RESOLVIDO** — Ollama externo | Decisão (com você): runtime = **Ollama externo** (`OLLAMA_URL`); vLLM/70B vira profile GPU opt-in. ADR-001 atualizado (#111). vLLM real ainda depende de **P-06** (GPU). |
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
| P-07 | ✅ **RESOLVIDO (parcial)** — Redis no compose | `redis` adicionado ao compose (#108) e o throttle de login já usa Redis (#109, com fallback em memória). **Confirme** apenas se a VPS de produção comporta o container Redis (recursos). WebSocket pub/sub (TKT-047) ainda usará o mesmo Redis. |
| P-08 | **Secrets do GitHub Actions p/ CD** (registry/deploy) | CD para GHCR + deploy (TKT-045) precisa de `GHCR_TOKEN`/chaves SSH ou kubeconfig. |

## 🚨 Bloqueio descoberto na execução
| # | Pendência | Contexto |
|---|---|---|
| P-09 | **GitHub Actions não executa jobs** | TODAS as runs do `ci.yml` concluem em **failure com 0 jobs** — falha de *startup*, anterior a qualquer step. Não é o código: é ambiente/conta (Actions sem runner ou limite de billing/spending). Por isso **não há como obter "CI verde"** corrigindo código. **Adaptação:** verifico cada PR **localmente** com os mesmos comandos do CI (`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `npm run build`, `npm test`) e mergeio com base nessa verificação, já que o `main` analisado também está vermelho por esse motivo. **Ação sua:** verificar billing/runners de Actions em github.com/danzeroum/btvChatCorp/settings/actions. |

## ✅ Como isso é tratado
- Itens acima estão **adiados** (⏸️ no `roadmap_v1.md`), não bloqueados: para cada um, deixo
  o **código/scaffold pronto** quando possível e marco o ponto exato que falta credencial/decisão.
- O resto do plano (que não depende de você) é executado e mergeado normalmente.
