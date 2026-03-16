-- Migration 004: Document Chunks para RAG
-- Executa após 001 (workspaces/users), 002 (documents), 003 (chats)

CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Conteúdo do chunk
    content         TEXT NOT NULL,
    chunk_index     INT NOT NULL,
    total_chunks    INT NOT NULL DEFAULT 0,

    -- Metadados para filtragem no Qdrant e auditoria
    section_title   VARCHAR(500),
    page_number     INT,
    chunk_type      VARCHAR(50) NOT NULL DEFAULT 'paragraph',
    -- paragraph, table, list, code, header, legal_clause, medical_section
    token_count     INT NOT NULL DEFAULT 0,

    -- Encadeamento bidirecional (context window retrieval)
    previous_chunk_id UUID REFERENCES document_chunks(id),
    next_chunk_id     UUID REFERENCES document_chunks(id),

    -- Controle de estado
    embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | processing | indexed | failed
    qdrant_point_id  VARCHAR(100),  -- ID do ponto no Qdrant (UUID string)
    indexed_at       TIMESTAMPTZ,
    error_message    TEXT,          -- Detalhe do erro se embedding_status = failed

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices principais
CREATE INDEX idx_chunks_document    ON document_chunks(document_id);
CREATE INDEX idx_chunks_workspace   ON document_chunks(workspace_id);
CREATE INDEX idx_chunks_status      ON document_chunks(embedding_status)
    WHERE embedding_status IN ('pending', 'failed');
CREATE INDEX idx_chunks_pending     ON document_chunks(document_id, chunk_index)
    WHERE embedding_status = 'pending';
CREATE UNIQUE INDEX idx_chunks_qdrant_point ON document_chunks(qdrant_point_id)
    WHERE qdrant_point_id IS NOT NULL;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atualiza documents.chunk_count via trigger
CREATE OR REPLACE FUNCTION sync_document_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE documents SET chunk_count = chunk_count + 1 WHERE id = NEW.document_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE documents SET chunk_count = GREATEST(chunk_count - 1, 0) WHERE id = OLD.document_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_chunk_count
    AFTER INSERT OR DELETE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION sync_document_chunk_count();
