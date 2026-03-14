-- 0004_training.sql
-- training_batches ja existe em 0003_chats.sql (sem workspace_id e campos de LoRA).
-- Adicionamos as colunas faltantes via ALTER TABLE (idempotente com IF NOT EXISTS do PG 9.6+).

ALTER TABLE training_batches
    ADD COLUMN IF NOT EXISTS workspace_id          UUID,
    ADD COLUMN IF NOT EXISTS base_model            TEXT NOT NULL DEFAULT 'llama3.1:8b',
    ADD COLUMN IF NOT EXISTS previous_lora_version TEXT,
    ADD COLUMN IF NOT EXISTS new_lora_version      TEXT,
    ADD COLUMN IF NOT EXISTS eval_accuracy         FLOAT8,
    ADD COLUMN IF NOT EXISTS external_job_id       TEXT,
    ADD COLUMN IF NOT EXISTS external_service_url  TEXT,
    ADD COLUMN IF NOT EXISTS error_message         TEXT;

-- Garante constraint de status se ainda nao existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'training_batches_status_check'
    ) THEN
        ALTER TABLE training_batches
            ADD CONSTRAINT training_batches_status_check
            CHECK (status IN ('pending','queued','running','completed','failed','cancelled'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tb_workspace ON training_batches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tb_status    ON training_batches(workspace_id, status) WHERE workspace_id IS NOT NULL;

-- Training interactions: pares user/assistant capturados do chat
CREATE TABLE IF NOT EXISTS training_interactions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id          UUID NOT NULL,
    chat_id               UUID REFERENCES chats(id) ON DELETE SET NULL,
    message_id            UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_message          TEXT NOT NULL,
    assistant_response    TEXT NOT NULL,
    user_rating           TEXT CHECK (user_rating IN ('positive','negative')),
    user_correction       TEXT,
    feedback_categories   TEXT,
    curator_status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (curator_status IN ('pending','approved','rejected')),
    curator_id            UUID,
    curated_at            TIMESTAMPTZ,
    eligible_for_training BOOL NOT NULL DEFAULT true,
    data_classification   TEXT NOT NULL DEFAULT 'internal',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ti_workspace ON training_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ti_status    ON training_interactions(workspace_id, curator_status);
CREATE INDEX IF NOT EXISTS idx_ti_eligible  ON training_interactions(workspace_id, eligible_for_training);

-- Training documents: pares QA sinteticos gerados a partir de chunks de documentos
CREATE TABLE IF NOT EXISTS training_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id        UUID NOT NULL,
    document_id         UUID REFERENCES documents(id) ON DELETE CASCADE,
    document_name       TEXT NOT NULL,
    chunk_text          TEXT NOT NULL,
    generated_question  TEXT NOT NULL,
    generated_answer    TEXT NOT NULL,
    classification      TEXT NOT NULL DEFAULT 'internal',
    curator_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (curator_status IN ('pending','approved','rejected')),
    curator_id          UUID,
    curated_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_td_workspace ON training_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_td_status    ON training_documents(workspace_id, curator_status);
