-- Sprint 1 — Tabela de refresh tokens
-- Cada linha representa um refresh token valido (nao revogado).
-- Ao fazer logout ou ao detectar roubo de token, seta revogado = true.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL UNIQUE,   -- SHA-256 do token JWT em hex
    expires_at   TIMESTAMPTZ NOT NULL,
    revogado     BOOLEAN     NOT NULL DEFAULT false,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent   TEXT,
    ip_address   INET
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens (user_id)
    WHERE revogado = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at)
    WHERE revogado = false;

COMMENT ON TABLE refresh_tokens IS
    'Refresh tokens emitidos pelo endpoint POST /auth/refresh.
     Um token e'' revogado ao fazer logout ou ao emitir um novo par (rotation).';
