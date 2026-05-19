# Sprint 1 — Grupo C: Segurança

**Branch:** `fix/s1-seguranca`  
**Issues:** #10 (S2), #11 (S5), #12 (S3), #13 (S4), #14 (D1)  
**Semana:** 2, Dias 6–8  
**Dependência:** Mergear após `fix/s1-migrations`

## Ordem de implementação nesta branch

### 1º — #10 S2: CORS

Arquivo alvo: `backend/crates/api/src/main.rs` ou camada de middleware Axum.

```rust
// Ler ALLOWED_ORIGINS do env
let allowed_origins: Vec<String> = std::env::var("ALLOWED_ORIGINS")
    .unwrap_or_default()
    .split(',')
    .map(|s| s.trim().to_string())
    .collect();
```

Configurar CorsLayer separado para `api` e `api-public`.

### 2º — #11 S5: Login unificado

- Frontend: `src/app/core/services/auth.service.ts`
- Remover `localStorage.setItem` direto do `LoginComponent`
- Centralizar em `AuthService`

### 3º — #12 S3: Refresh tokens

- Adicionar `redis` ao `Cargo.toml`
- Novo endpoint: `POST /auth/refresh`
- Access token TTL: **15 min**
- Refresh token TTL: **7 dias** (Redis key com `EXPIRE`)
- Rotação obrigatória a cada uso

### 4º — #13 S4: Ownership de workspace

Criar extractor Axum reutilizável:

```rust
// backend/crates/api/src/extractors/workspace_owner.rs
pub struct WorkspaceOwner(pub Uuid);

#[async_trait]
impl<S> FromRequestParts<S> for WorkspaceOwner { ... }
```

Aplicar nos handlers de `documents`, `chats`, `feedback`.

### 5º — #14 D1: TLS nginx

- `nginx/nginx.conf`: adicionar bloco `server` 443 + redirect 80→443 + HSTS
- Certificados montados como volume (`/etc/letsencrypt`), nunca no Git

## Comandos de validação

```bash
# CORS:
curl -H 'Origin: https://evil.com' http://localhost/api/v1/health
# Esperado: 403

curl -H 'Origin: http://localhost:4200' http://localhost/api/v1/health  
# Esperado: 200

# Refresh token:
curl -X POST http://localhost/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token": "<token>"}'
# Esperado: {"access_token": "...", "expires_in": 900}

# Workspace ownership:
curl -H 'Authorization: Bearer <token_workspace_A>' \
  http://localhost/api/v1/documents/<id_workspace_B>
# Esperado: 403

# TLS:
curl -I https://seudominio.com
# Esperado: Strict-Transport-Security no header
```
