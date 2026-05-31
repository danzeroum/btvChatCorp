# ADR-004 — Autenticação: JWT + RBAC

**Status:** Atualizado (2026-05)
**Data original:** 2026-03

## Contexto

O sistema serve múltiplos workspaces corporativos isolados. Cada workspace precisa de controle de acesso granular. A decisão original especificava refresh token em httpOnly cookie e Redis. A implementação atual difere em alguns pontos.

## Decisão Atual (implementada no crate `api`)

- **Access token JWT HS256** com validade configurável via `JWT_EXPIRY_HOURS` (default 1h)
- **Claims JWT**: `sub` (user_id), `workspace_id`, `role`, `exp`, `iss: "btvchatcorp"`, `aud: ["btvchatcorp-api"]`
- **Renovação**: `POST /api/v1/auth/refresh` recebe `{ refresh_token }` e emite novo access token se válido. O backend valida que o usuário ainda está ativo no banco antes de emitir.
- **RBAC**: roles `owner`, `admin`, `user`; admin guard no painel admin via middleware `require_admin_role`
- **Brute-force protection**: 5 tentativas falhas por IP em 15 minutos → 429; contagem zerada no login bem-sucedido
- **Fonte de verdade do cliente**: `GET /api/v1/auth/me` para obter roles/workspace frescos do banco; frontend não deve confiar apenas no payload do JWT

## Estado Pendente (não implementado)

- Redis para revogação imediata de tokens ainda não implementado (ver `JWT_EXPIRY_HOURS=1`)
- MFA TOTP ainda não implementado
- SSO OIDC/SAML ainda não implementado

## Consequências

**Positivas:**
- Access token de curta duração (1h) limita janela de replay
- Validação server-side no refresh: usuário desativado não renova sessão
- Claims `iss`/`aud` emitidos em tokens novos (backward-compatible com tokens legados)

**Negativas / Trade-offs:**
- Sem Redis: logout não invalida tokens emitidos imediatamente (janela = JWT_EXPIRY_HOURS)
- Refresh token é um access token válido — não um token de longa duração separado
