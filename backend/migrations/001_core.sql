-- =============================================
-- Migration 001: Core tables
-- BTV Chat Corp
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Workspaces ───────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    sector      TEXT,                        -- legal, health, finance, tech, other
    language    TEXT NOT NULL DEFAULT 'pt-BR',
    timezone    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    UNIQUE (workspace_id, email)
);

CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE projects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    description       TEXT,
    icon              TEXT DEFAULT '📁',
    color             TEXT DEFAULT '#6366f1',
    status            TEXT NOT NULL DEFAULT 'active',  -- active, archived
    category          TEXT,
    priority          TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high
    tags              TEXT[] NOT NULL DEFAULT '{}',
    created_by        UUID NOT NULL REFERENCES users(id),
    last_activity_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_workspace ON projects(workspace_id);
CREATE INDEX idx_projects_status ON projects(workspace_id, status);

-- ─── Project Members ──────────────────────────────────────────────────────────
CREATE TABLE project_members (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'editor',  -- owner, editor, viewer
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- ─── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    filename           TEXT NOT NULL,
    original_filename  TEXT NOT NULL,
    mime_type          TEXT NOT NULL,
    size_bytes         BIGINT NOT NULL,
    file_hash          TEXT NOT NULL,
    storage_path       TEXT NOT NULL,
    processing_status  TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, indexed, failed
    page_count         INT,
    chunk_count        INT,
    error_message      TEXT,
    uploaded_by        UUID NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_status ON documents(processing_status);

-- ─── Project Documents (pivot) ────────────────────────────────────────────────
CREATE TABLE project_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    folder       TEXT,
    notes        TEXT,
    is_pinned    BOOLEAN NOT NULL DEFAULT false,
    linked_by    UUID NOT NULL REFERENCES users(id),
    linked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, document_id)
);

-- ─── Chats ────────────────────────────────────────────────────────────────────
CREATE TABLE chats (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    title         TEXT NOT NULL DEFAULT 'Nova conversa',
    summary       TEXT,
    is_pinned     BOOLEAN NOT NULL DEFAULT false,
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chats_workspace ON chats(workspace_id);
CREATE INDEX idx_chats_project ON chats(project_id);
CREATE INDEX idx_chats_updated ON chats(workspace_id, updated_at DESC);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,  -- user, assistant, system
    content         TEXT NOT NULL,
    sources         JSONB,          -- chunks RAG usados
    tokens_used     INT,
    feedback        SMALLINT,       -- 1 positivo, -1 negativo, NULL sem feedback
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_chat ON messages(chat_id, created_at);

-- ─── Project Instructions (System Prompts) ────────────────────────────────────
CREATE TABLE project_instructions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    content       TEXT NOT NULL,
    trigger_mode  TEXT NOT NULL DEFAULT 'always',  -- always, manual, keyword
    keywords      TEXT[],
    is_active     BOOLEAN NOT NULL DEFAULT true,
    version       INT NOT NULL DEFAULT 1,
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instructions_project ON project_instructions(project_id, is_active);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id),
    action        TEXT NOT NULL,
    resource      TEXT NOT NULL,
    resource_id   TEXT,
    details       JSONB,
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
