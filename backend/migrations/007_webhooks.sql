-- Tabelas de webhooks consumidas pelo crate `webhooks` (dispatcher + store).
-- Esquema mínimo e coerente com as queries de WebhookStore.

CREATE TABLE IF NOT EXISTS webhooks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL,
    name                  TEXT NOT NULL DEFAULT '',
    url                   TEXT NOT NULL,
    secret                TEXT NOT NULL DEFAULT '',
    -- Lista de tipos de evento inscritos, ex: ["chat_created","document_uploaded"]
    events                JSONB NOT NULL DEFAULT '[]'::jsonb,
    status                TEXT NOT NULL DEFAULT 'active',
    timeout_secs          BIGINT NOT NULL DEFAULT 30,
    consecutive_failures  INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_active
    ON webhooks(workspace_id)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id            UUID PRIMARY KEY,
    webhook_id    UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    status        TEXT NOT NULL,
    status_code   INTEGER NOT NULL DEFAULT 0,
    attempt       INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON webhook_deliveries(webhook_id);
