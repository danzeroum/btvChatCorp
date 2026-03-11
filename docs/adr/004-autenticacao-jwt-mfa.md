# ADR-004 — Autenticação: JWT + MFA TOTP + RBAC

**Status:** Aceito  
**Data:** 2026-03

## Contexto

O sistema serve múltiplos workspaces corporativos isolados. Cada workspace precisa de controle de acesso granular com suporte a SSO (Google, Microsoft, SAML) e MFA obrigatório para administradores.

## Decisão

- **Access token JWT** com validade de 15 minutos
- **Refresh token** com validade de 7 dias, armazenado em `httpOnly` cookie
- **MFA TOTP** (RFC 6238) via `pyotp` — obrigatório para role `admin` e `curator`
- **RBAC** com 4 roles: `super_admin`, `admin`, `curator`, `member`
- **SSO** via OAuth2 (Google/Microsoft) e SAML 2.0 como provedor alternativo
- Refresh tokens armazenados no **Redis** com TTL para revogação imediata

## Justificativa

JWT stateless reduz carga no banco para autenticação. O armazenamento do refresh token no Redis permite logout global e revogação por sessão sem invalidar o access token imediatamente — trade-off deliberado de 15 minutos aceito.

## Consequências

**Positivas:**
- Revogação imediata de sessão via Redis
- MFA TOTP sem dependência de SMS (resistente a SIM swap)
- SSO reduz fricção de onboarding corporativo

**Negativas / Trade-offs:**
- Access token válido por até 15 min mesmo após logout (janela de risco aceita)
- Requer Redis em alta disponibilidade para não bloquear refresh
