-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    key_hash         VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 hex
    key_prefix       VARCHAR(20) NOT NULL,           -- 'sk-live-abc1' para identificação
    permissions      JSONB NOT NULL DEFAULT '[]',    -- [{"resource":"chat","actions":["write"]}]
    project_scope    VARCHAR(20) DEFAULT 'all',      -- 'all' | 'specific'
    allowed_project_ids JSONB,                       -- ["uuid1","uuid2"]
    allowed_ips      JSONB,                          -- ["","10.0.0.0/8"]
    allowed_origins  JSONB,                          -- CORS
    rate_limit_rpm   INT NOT NULL DEFAULT 60,
    status           VARCHAR(20) DEFAULT 'active',   -- active | revoked | expired
    expires_at       TIMESTAMPTZ,
    last_used_at     TIMESTAMPTZ,
    total_requests   BIGINT DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    created_by       UUID REFERENCES users(id),
    revoked_at       TIMESTAMPTZ,
    revoked_by       UUID REFERENCES users(id),
    CONSTRAINT valid_status CHECK (status IN ('active','revoked','expired'))
);

CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id) WHERE status = 'active';
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    url                   TEXT NOT NULL,
    secret                VARCHAR(255) NOT NULL,     -- HMAC secret
    events                JSONB NOT NULL DEFAULT '[]',
    filters               JSONB,
    max_retries           INT DEFAULT 5,
    timeout_secs          INT DEFAULT 10,
    custom_headers        JSONB,
    status                VARCHAR(20) DEFAULT 'active', -- active | paused | failing
    consecutive_failures  INT DEFAULT 0,
    last_delivery_at      TIMESTAMPTZ,
    last_delivery_status  INT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_workspace ON webhooks(workspace_id) WHERE status = 'active';

-- Log de entregas de webhooks
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id       UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type       VARCHAR(100) NOT NULL,
    payload          JSONB,
    attempt_number   INT DEFAULT 1,
    status           VARCHAR(20) DEFAULT 'pending',  -- pending | delivered | failed | retrying
    http_status      INT,
    response_body    TEXT,
    response_time_ms INT,
    error_message    TEXT,
    scheduled_at     TIMESTAMPTZ DEFAULT NOW(),
    delivered_at     TIMESTAMPTZ,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_deliveries_retry ON webhook_deliveries(next_retry_at)
    WHERE status IN ('pending', 'retrying');
