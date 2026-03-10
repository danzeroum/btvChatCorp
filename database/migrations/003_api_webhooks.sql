-- ============================================================
-- MIGRATION 003: API Pública e Webhooks
-- ============================================================

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    key_prefix VARCHAR(20) NOT NULL,   -- 'sk-live-abc1' (primeiros chars)
    key_hash VARCHAR(128) NOT NULL,     -- SHA-256 hash (nunca a key real)
    permissions JSONB NOT NULL DEFAULT '[]',
    allowed_ips TEXT[],
    allowed_origins TEXT[],
    rate_limit INT NOT NULL DEFAULT 60, -- requests por minuto
    project_scope VARCHAR(20) DEFAULT 'all',
    allowed_project_ids UUID[],
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    total_requests BIGINT DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE status = 'active';

-- Webhooks
CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    secret VARCHAR(200) NOT NULL,
    events TEXT[] NOT NULL,
    filters JSONB,
    delivery_config JSONB NOT NULL DEFAULT '{"timeout": 10, "maxRetries": 5, "retryBackoff": "exponential"}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failing')),
    consecutive_failures INT DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de entrega de webhook
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    http_status INT,
    response_body TEXT,
    response_time_ms INT,
    error_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_webhook_status
    ON webhook_deliveries(webhook_id, status, created_at DESC);
CREATE INDEX idx_deliveries_retry
    ON webhook_deliveries(next_retry_at)
    WHERE status = 'retrying';

-- Request logs para billing e debugging
CREATE TABLE api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    api_key_id UUID NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INT NOT NULL,
    tokens_input INT DEFAULT 0,
    tokens_output INT DEFAULT 0,
    request_time_ms INT,
    client_ip VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_api_logs_workspace_date
    ON api_request_logs(workspace_id, created_at DESC);
