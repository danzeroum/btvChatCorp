-- Extensoes necessarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    timezone   TEXT NOT NULL DEFAULT 'UTC',
    language   TEXT NOT NULL DEFAULT 'pt-BR',
    session_timeout_minutes     INT  NOT NULL DEFAULT 480,
    max_concurrent_sessions     INT  NOT NULL DEFAULT 5,
    mfa_required                BOOL NOT NULL DEFAULT false,
    notify_on_new_user          BOOL NOT NULL DEFAULT true,
    notify_on_training_complete BOOL NOT NULL DEFAULT true,
    notify_on_security_event    BOOL NOT NULL DEFAULT true,
    notification_email          TEXT NOT NULL DEFAULT '',
    allow_user_self_registration BOOL NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_system   BOOL NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email          TEXT NOT NULL,
    name           TEXT NOT NULL DEFAULT '',
    password_hash  TEXT NOT NULL DEFAULT '',
    role_id        UUID REFERENCES roles(id),
    role_name      TEXT NOT NULL DEFAULT 'user',
    status         TEXT NOT NULL DEFAULT 'active',
    mfa_enabled    BOOL NOT NULL DEFAULT false,
    last_login_at  TIMESTAMPTZ,
    last_login_ip  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '8 hours'
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name     TEXT NOT NULL DEFAULT 'system',
    user_ip       TEXT,
    action        TEXT NOT NULL,
    resource_name TEXT NOT NULL DEFAULT '',
    severity      TEXT NOT NULL DEFAULT 'info',
    category      TEXT NOT NULL DEFAULT 'general',
    details       JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
