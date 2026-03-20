-- Migration 002: colunas necessárias para o pipeline RAG
-- Adiciona retry_count e error_message na tabela documents
-- (caso não existam ainda)

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS retry_count    INT     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message  TEXT;

-- Índice para o worker buscar documentos pending eficientemente
CREATE INDEX IF NOT EXISTS idx_documents_pending
    ON documents (processing_status, retry_count)
    WHERE processing_status = 'pending';

-- Tabela de chunks indexados
CREATE TABLE IF NOT EXISTS document_chunks (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id   UUID        NOT NULL,
    chunk_index    INT         NOT NULL,
    section_title  TEXT,
    content        TEXT        NOT NULL,
    token_count    INT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document
    ON document_chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_workspace
    ON document_chunks (workspace_id);
