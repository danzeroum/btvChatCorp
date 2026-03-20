-- training_interactions: interações de chat elegíveis para fine-tuning
CREATE TABLE IF NOT EXISTS training_interactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    message_id           UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_message         TEXT NOT NULL,
    assistant_response   TEXT NOT NULL,
    user_rating          TEXT,          -- 'positive' | 'negative' | NULL
    user_correction      TEXT,          -- texto corrigido pelo usuário
    feedback_categories  TEXT,          -- json array serializado
    curator_status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    curator_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    curated_at           TIMESTAMPTZ,
    data_classification  TEXT NOT NULL DEFAULT 'internal',
    eligible_for_training BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_interactions_workspace
    ON training_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_training_interactions_status
    ON training_interactions(workspace_id, curator_status)
    WHERE eligible_for_training = true;

-- training_batches: jobs de fine-tuning disparados pelo curador
CREATE TABLE IF NOT EXISTS training_batches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    base_model            TEXT NOT NULL DEFAULT 'llama3.1:8b',
    previous_lora_version TEXT,
    new_lora_version      TEXT,
    status                TEXT NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed
    total_examples        INT,
    positive_examples     INT,
    corrected_examples    INT,
    progress              INT,
    current_epoch         INT,
    total_epochs          INT,
    training_loss         DOUBLE PRECISION,
    eval_accuracy         DOUBLE PRECISION,
    external_job_id       TEXT,
    error_message         TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    deployed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_training_batches_workspace
    ON training_batches(workspace_id, created_at DESC);

-- training_documents: pares sintéticos Q&A gerados a partir de documentos
CREATE TABLE IF NOT EXISTS training_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES documents(id) ON DELETE SET NULL,
    document_name       TEXT NOT NULL,
    chunk_text          TEXT NOT NULL,
    generated_question  TEXT NOT NULL,
    generated_answer    TEXT NOT NULL,
    classification      TEXT NOT NULL DEFAULT 'internal',
    curator_status      TEXT NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_documents_workspace
    ON training_documents(workspace_id);
