-- Migration 005: Document Chunks completo para RAG
-- Expande a tabela document_chunks criada na 002 com colunas adicionais
-- e recria índices com segurança (IF NOT EXISTS)

-- Colunas adicionais (podem não existir se veio só da 002)
ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS total_chunks      INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS page_number       INT,
    ADD COLUMN IF NOT EXISTS chunk_type        VARCHAR(50)  NOT NULL DEFAULT 'paragraph',
    ADD COLUMN IF NOT EXISTS previous_chunk_id UUID         REFERENCES document_chunks(id),
    ADD COLUMN IF NOT EXISTS next_chunk_id     UUID         REFERENCES document_chunks(id),
    ADD COLUMN IF NOT EXISTS embedding_status  VARCHAR(20)  NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS qdrant_point_id   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS indexed_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS error_message     TEXT;

-- Índices (todos idempotentes)
CREATE INDEX IF NOT EXISTS idx_chunks_document
    ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_chunks_workspace
    ON document_chunks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_chunks_status
    ON document_chunks(embedding_status)
    WHERE embedding_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_chunks_pending
    ON document_chunks(document_id, chunk_index)
    WHERE embedding_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_qdrant_point
    ON document_chunks(qdrant_point_id)
    WHERE qdrant_point_id IS NOT NULL;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chunks_updated_at'
    ) THEN
        CREATE TRIGGER trg_chunks_updated_at
            BEFORE UPDATE ON document_chunks
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Trigger: sincroniza chunk_count em documents
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

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_chunk_count'
    ) THEN
        CREATE TRIGGER trg_sync_chunk_count
            AFTER INSERT OR DELETE ON document_chunks
            FOR EACH ROW EXECUTE FUNCTION sync_document_chunk_count();
    END IF;
END $$;
