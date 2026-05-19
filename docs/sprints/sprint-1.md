# Sprint 1 — Estabilização e Segurança

**Duração:** 2 semanas | **Início:** 19/05/2026  
**Épico:** [Issue #5](https://github.com/danzeroum/btvChatCorp/issues/5)

> **Objetivo:** Fazer o projeto compilar, remover todo código morto, consolidar o schema de banco de dados, implementar segurança básica (TLS, CORS, refresh tokens) e entregar um sistema que sobe com `docker compose --profile core up`.

---

## Grupo A — Compilabilidade (Semana 1, Dias 1–3)

### B2 — Corrigir dependências Rust
**Severidade:** ALTA | **Esforço:** Alto | **Issue:** #6

- Adicionar `hex`, `hmac` e `governor` ao `Cargo.toml` do crate `api`
- Alinhar `sqlx` para `0.8` em todos os crates (breaking change: revisar macros `query!` e `query_as!`)
- Alinhar `reqwest` para `0.12` em todos os crates
- Testar com `cargo check --workspace` após cada crate corrigido

**Ponto de atenção:** A migração de sqlx 0.7 → 0.8 é breaking change. Revisar cada uso e ajustar assinaturas antes do `cargo build`.

---

### B3 — Remover código morto do backend
**Severidade:** ALTA | **Esforço:** Médio | **Issue:** #7

Deletar:
- Rotas órfãs: `admin.rs`, `chat.rs`, `feedback.rs`, `search.rs`, `usage.rs`, `webhooks.rs`
- Middlewares órfãos: `api_key_auth.rs`, `admin_guard.rs`, `audit_logger.rs`, `request_logger.rs`, `rate_limiter.rs`, `usage_tracker.rs`
- `models/admin.rs` e `services/admin_service.rs`

**Ponto de atenção:** Antes de deletar, verificar se alguma funcionalidade é necessária e não existe nos arquivos ativos. Documentar funcionalidades descartadas em ADR.

---

### B4 — Limpar stubs Python
**Severidade:** MÉDIA | **Esforço:** Baixo | **Issue:** #8

- Remover `backend/app/` (todos os arquivos com `# REMOVIDO`)
- Remover `backend/requirements.txt`
- Remover `training/` na raiz (versão antiga duplicada)

**Ponto de atenção:** O `Dockerfile.training` referencia `backend/training/`. Garantir que a versão correta (`backend/training/`) permanece intacta após a limpeza.

---

## Grupo B — Banco de Dados (Semana 1, Dias 3–5)

### B1 — Consolidar migrations
**Severidade:** ALTA | **Esforço:** Médio | **Issue:** #9

- Manter apenas `backend/migrations/` como diretório ativo
- Deletar `database/migrations/` e `backend/crates/api/migrations/`
- Revisar cada tabela no schema ativo: garantir cobertura de `roles`, `sessions`, `api_keys`, `usage_events`, `workspace_ai_config`
- Reescrever como `001_inicial.sql` unificado com `IF NOT EXISTS` em todos os `CREATE TABLE`
- Documentar cada tabela com comentários SQL

**Ponto de atenção:** Se há dados em produção, criar script de migração com `ALTER TABLE` em vez de recriar. O "split-brain" atual faz queries de administração falharem em runtime com `relation does not exist`.

---

## Grupo C — Segurança (Semana 2, Dias 6–8)

### S2 — Restringir CORS
**Severidade:** CRÍTICA | **Esforço:** Baixo | **Issue:** #10

- Configurar `allowed_origins` a partir de `ALLOWED_ORIGINS` (variável de ambiente)
- Exemplo: `ALLOWED_ORIGINS=https://app.btvc.com,https://admin.btvc.com`
- Em dev: manter `localhost`
- Implementar configuração separada para `api` e `api-public`

**Ponto de atenção:** CORS aberto permite ataques CSRF que podem exfiltrar dados de outros workspaces. Risco LGPD direto.

---

### S5 — Unificar fluxo de login
**Severidade:** ALTA | **Esforço:** Baixo | **Issue:** #11

- Adotar fluxo do `LoginComponent` (JSON, `POST /api/v1/auth/login`, campo `response.token`)
- Refatorar `AuthService.login()` para usar o mesmo formato
- Migrar armazenamento de tokens de `localStorage` direto para `AuthService` como single source of truth
- Adicionar campo `access_token` ao response do backend se necessário

---

### S3 — Refresh tokens com Redis
**Severidade:** CRÍTICA | **Esforço:** Médio | **Issue:** #12

- Adicionar serviço Redis ao `docker-compose.yml`
- Implementar endpoint `POST /auth/refresh`
- Access token: validade **15 minutos**
- Refresh token: validade **7 dias**, rotação a cada uso
- Armazenar refresh tokens no Redis com TTL

**Ponto de atenção:** ADR-004 já documenta esta decisão, mas Redis nunca foi implementado. JWTs com 30 dias sem revogação violam LGPD (minimização de dados).

---

### S4 — Validar propriedade de workspace
**Severidade:** CRÍTICA | **Esforço:** Baixo | **Issue:** #13

- Adicionar verificação em todos endpoints que recebem IDs de recursos: `documents`, `chats`, `feedback`
- Criar middleware/extractor reutilizável em Rust (evitar repetição de lógica)
- No frontend: garantir que `workspace_id` correto é passado em todas as chamadas

**Ponto de atenção:** Sem este controle, usuário de workspace A pode acessar dados do workspace B. Viola isolamento multi-tenant e LGPD.

---

### D1 — Configurar TLS no nginx
**Severidade:** ALTA | **Esforço:** Baixo | **Issue:** #14

- Gerar certificados com `certbot` (Let's Encrypt)
- Configurar `nginx.conf`: escutar 443 com SSL, redirecionar 80 → 443, habilitar HSTS
- Certificados provisionados via `certbot`, nunca versionados no Git

**Ponto de atenção:** Em Docker, usar desafio `dns-01` se a porta 80 não estiver acessível diretamente. O `privkey.pem` já foi revogado na Sprint 0.

---

## Grupo D — Infraestrutura (Semana 2, Dias 9–10)

### T3 (Parcial) — Docker-compose funcional
**Severidade:** ALTA | **Esforço:** Médio | **Issue:** #15

- Completar `docker-compose.yml` com serviços: Redis, embedding (mínimo para o sistema funcionar)
- Usar profiles: `docker compose --profile core up` sobe apenas `postgres`, `qdrant`, `redis`, `api`, `embedding`, `frontend`, `nginx`
- Adicionar `healthcheck` em todos os serviços com `condition: service_healthy` nas dependências

**Ponto de atenção:** O serviço de embedding pode demorar para carregar o modelo Nomic. O healthcheck deve aguardar o modelo estar carregado, não apenas o servidor responder.

Serviços restantes (vllm, training, document-processor, reranker, rag-searcher) ficam para Sprint 2.

---

## ⚠️ Risco Principal

A consolidação de migrations pode revelar que dados existentes em produção são incompatíveis com o schema final. Neste caso, será necessário um script de migração de dados além do script de migração de schema.

---

## ✅ Critérios de Aceitação

- [ ] `cargo build --workspace` compila sem erros
- [ ] `docker compose --profile core up` sobe todos os serviços e healthchecks passam
- [ ] TLS funciona no nginx (HTTPS, redirect 80→443, HSTS)
- [ ] CORS rejeita origens não configuradas em `ALLOWED_ORIGINS`
- [ ] Refresh tokens funcionam (access: 15min, refresh: 7 dias com rotação)
- [ ] Todos os endpoints validam propriedade de workspace
- [ ] Login funciona via fluxo único (`AuthService`)
- [ ] Nenhum arquivo Python stub permanece no projeto
- [ ] Um único diretório de migrations (`backend/migrations/`)

---

*Ref: btvChatCorp_Validacao_Cruzada_Sprints.pdf — Seção 4.2*
