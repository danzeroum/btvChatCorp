-- Chats
CREATE TABLE IF NOT EXISTS chats (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
    title        TEXT NOT NULL DEFAULT 'Nova conversa',
    summary      TEXT,
    is_pinned    BOOL NOT NULL DEFAULT false,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    sources     JSONB,
    tokens_used INT,
    feedback    SMALLINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage metrics (tabela de agregacao para o admin)
CREATE TABLE IF NOT EXISTS usage_metrics (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id             UUID NOT NULL,
    period                   TEXT NOT NULL DEFAULT 'day',
    period_start             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_tokens_input       BIGINT NOT NULL DEFAULT 0,
    total_tokens_output      BIGINT NOT NULL DEFAULT 0,
    total_tokens_embedding   BIGINT NOT NULL DEFAULT 0,
    total_chat_requests      BIGINT NOT NULL DEFAULT 0,
    total_rag_queries        BIGINT NOT NULL DEFAULT 0,
    total_documents_processed BIGINT NOT NULL DEFAULT 0,
    active_users             BIGINT NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily metrics para graficos
CREATE TABLE IF NOT EXISTS daily_metrics (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL,
    date         TIMESTAMPTZ NOT NULL,
    messages     BIGINT NOT NULL DEFAULT 0,
    tokens       BIGINT NOT NULL DEFAULT 0,
    users        BIGINT NOT NULL DEFAULT 0,
    documents    BIGINT NOT NULL DEFAULT 0
);

-- AI Models
CREATE TABLE IF NOT EXISTS ai_models (
    id                   TEXT PRIMARY KEY,
    display_name         TEXT NOT NULL,
    base_model           TEXT NOT NULL DEFAULT '',
    inference_url        TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active',
    default_temperature  FLOAT8 NOT NULL DEFAULT 0.7,
    default_max_tokens   INT NOT NULL DEFAULT 2048,
    context_window_size  INT NOT NULL DEFAULT 4096,
    avg_latency_ms       INT NOT NULL DEFAULT 0,
    requests_per_minute  INT NOT NULL DEFAULT 60,
    gpu_utilization      INT NOT NULL DEFAULT 0,
    active_lora_version  TEXT
);

-- Lora adapters
CREATE TABLE IF NOT EXISTS lora_adapters (
    version                    TEXT PRIMARY KEY,
    path                       TEXT NOT NULL DEFAULT '',
    trained_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    training_examples          INT NOT NULL DEFAULT 0,
    training_loss              FLOAT8 NOT NULL DEFAULT 0,
    eval_accuracy              FLOAT8 NOT NULL DEFAULT 0,
    status                     TEXT NOT NULL DEFAULT 'pending',
    deployed_at                TIMESTAMPTZ,
    improvement_vs_previous    FLOAT8
);

-- Training batches
CREATE TABLE IF NOT EXISTS training_batches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status              TEXT NOT NULL DEFAULT 'pending',
    total_examples      INT,
    positive_examples   INT,
    corrected_examples  INT,
    progress            INT,
    current_epoch       INT,
    total_epochs        INT,
    training_loss       FLOAT8,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    deployed_at         TIMESTAMPTZ
);

-- RAG config
CREATE TABLE IF NOT EXISTS rag_config (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    top_k                INT NOT NULL DEFAULT 5,
    chunk_size           INT NOT NULL DEFAULT 512,
    chunk_overlap        INT NOT NULL DEFAULT 64,
    similarity_threshold FLOAT8 NOT NULL DEFAULT 0.75
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id   UUID NOT NULL,
    name           TEXT NOT NULL,
    prefix         TEXT NOT NULL,
    masked_key     TEXT NOT NULL DEFAULT '',
    key_hash       TEXT NOT NULL DEFAULT '',
    permissions    JSONB NOT NULL DEFAULT '[]',
    rate_limit     INT NOT NULL DEFAULT 60,
    expires_at     TIMESTAMPTZ,
    last_used_at   TIMESTAMPTZ,
    usage_today    BIGINT DEFAULT 0,
    usage_total    BIGINT DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    revoked_at     TIMESTAMPTZ
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id          UUID NOT NULL,
    name                  TEXT NOT NULL,
    url                   TEXT NOT NULL,
    secret                TEXT NOT NULL DEFAULT '',
    events                JSONB NOT NULL DEFAULT '[]',
    status                TEXT NOT NULL DEFAULT 'active',
    retry_policy          TEXT NOT NULL DEFAULT 'exponential',
    timeout_ms            INT NOT NULL DEFAULT 5000,
    success_rate          FLOAT8,
    total_deliveries      BIGINT,
    last_delivery_at      TIMESTAMPTZ,
    last_delivery_status  INT,
    consecutive_failures  INT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id       UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event            TEXT NOT NULL,
    url              TEXT NOT NULL,
    request_body     TEXT,
    request_headers  JSONB,
    response_status  INT,
    response_body    TEXT,
    duration_ms      INT,
    status           TEXT NOT NULL DEFAULT 'pending',
    attempt          INT NOT NULL DEFAULT 1,
    max_attempts     INT NOT NULL DEFAULT 3,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at     TIMESTAMPTZ,
    next_retry_at    TIMESTAMPTZ
);

-- Resource limits
CREATE TABLE IF NOT EXISTS resource_limits (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id             UUID NOT NULL,
    type                     TEXT NOT NULL,
    target_name              TEXT NOT NULL DEFAULT '',
    max_tokens_per_day       BIGINT,
    max_messages_per_day     BIGINT,
    max_documents_total      BIGINT,
    max_storage_gb           FLOAT8,
    max_api_requests_per_min BIGINT,
    current_tokens_today     BIGINT NOT NULL DEFAULT 0,
    current_messages_today   BIGINT NOT NULL DEFAULT 0,
    current_documents_total  BIGINT NOT NULL DEFAULT 0,
    current_storage_gb       FLOAT8 NOT NULL DEFAULT 0,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id     UUID NOT NULL,
    data_type        TEXT NOT NULL,
    retention_days   INT,
    auto_delete_enabled BOOL NOT NULL DEFAULT false,
    last_purge_at    TIMESTAMPTZ,
    next_purge_at    TIMESTAMPTZ,
    current_size_gb  FLOAT8 NOT NULL DEFAULT 0,
    item_count       BIGINT NOT NULL DEFAULT 0,
    purgeable        BOOL NOT NULL DEFAULT false
);

-- Deletion requests
CREATE TABLE IF NOT EXISTS deletion_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id   UUID NOT NULL,
    type           TEXT NOT NULL,
    requested_by   TEXT NOT NULL DEFAULT '',
    target_name    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at   TIMESTAMPTZ,
    items_deleted  BIGINT
);

-- Branding config
CREATE TABLE IF NOT EXISTS branding_config (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id          UUID NOT NULL UNIQUE,
    product_name          TEXT NOT NULL DEFAULT 'BTV Chat',
    tagline               TEXT NOT NULL DEFAULT '',
    logo_url              TEXT,
    favicon_url           TEXT,
    primary_color         TEXT NOT NULL DEFAULT '#6366f1',
    secondary_color       TEXT NOT NULL DEFAULT '#8b5cf6',
    accent_color          TEXT NOT NULL DEFAULT '#f59e0b',
    bg_color              TEXT NOT NULL DEFAULT '#0f172a',
    surface_color         TEXT NOT NULL DEFAULT '#1e293b',
    text_color            TEXT NOT NULL DEFAULT '#f8fafc',
    font_family           TEXT NOT NULL DEFAULT 'Inter',
    custom_font_url       TEXT,
    custom_domain         TEXT,
    custom_domain_status  TEXT,
    show_powered_by       BOOL NOT NULL DEFAULT true,
    terms_url             TEXT,
    privacy_url           TEXT,
    support_email         TEXT,
    features              JSONB NOT NULL DEFAULT '{}'
);
