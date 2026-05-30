-- Tabela de API keys da API Pública, consumida pelo middleware `api_key_auth`
-- do crate `api-public`. Estava apenas nas árvores de migration órfãs (removidas
-- no C11/#70); recriada no esquema canônico para o `sqlx::query!` compilar.

CREATE TABLE IF NOT EXISTS api_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL,
    name                 TEXT NOT NULL DEFAULT '',
    -- hash da chave: HMAC-SHA256 (atual) ou SHA-256 puro (legado, em migração)
    key_hash             TEXT NOT NULL,
    permissions          JSONB,
    project_scope        TEXT,
    allowed_project_ids  JSONB,
    rate_limit           INTEGER,
    status               TEXT NOT NULL DEFAULT 'active',
    request_count        BIGINT NOT NULL DEFAULT 0,
    last_used_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
    ON api_keys(key_hash)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
    ON api_keys(workspace_id);
