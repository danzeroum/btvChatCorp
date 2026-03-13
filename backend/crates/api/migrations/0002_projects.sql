-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id     UUID NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    icon             TEXT,
    color            TEXT,
    status           TEXT NOT NULL DEFAULT 'active',
    category         TEXT,
    priority         TEXT NOT NULL DEFAULT 'medium',
    tags             TEXT[] NOT NULL DEFAULT '{}',
    created_by       UUID NOT NULL,
    last_activity_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project instructions
CREATE TABLE IF NOT EXISTS project_instructions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    content      TEXT NOT NULL,
    description  TEXT,
    trigger_mode TEXT NOT NULL DEFAULT 'always',
    is_active    BOOL NOT NULL DEFAULT true,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id       UUID NOT NULL,
    filename           TEXT NOT NULL,
    original_filename  TEXT NOT NULL,
    mime_type          TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes         BIGINT NOT NULL DEFAULT 0,
    file_hash          TEXT NOT NULL DEFAULT '',
    storage_path       TEXT NOT NULL DEFAULT '',
    processing_status  TEXT NOT NULL DEFAULT 'pending',
    page_count         INT,
    chunk_count        INT,
    uploaded_by        UUID NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project <-> Document link
CREATE TABLE IF NOT EXISTS project_documents (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    linked_by   UUID NOT NULL,
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, document_id)
);
