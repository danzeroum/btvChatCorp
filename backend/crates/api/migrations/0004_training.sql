-- Training interactions: pares user/assistant capturados do chat
CREATE TABLE IF NOT EXISTS training_interactions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id         UUID NOT NULL,
    chat_id              UUID REFERENCES chats(id) ON DELETE SET NULL,
    message_id           UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_message         TEXT NOT NULL,
    assistant_response   TEXT NOT NULL,
    -- Feedback do usuario
    user_rating          TEXT CHECK (user_rating IN ('positive','negative')),
    user_correction      TEXT,
    feedback_categories  TEXT,
    -- Curadoria
    curator_status       TEXT NOT NULL DEFAULT 'pending'
                         CHECK (curator_status IN ('pending','approved','rejected')),
    curator_id           UUID,
    curated_at           TIMESTAMPTZ,
    -- Controle
    eligible_for_training BOOL NOT NULL DEFAULT true,
    data_classification  TEXT NOT NULL DEFAULT 'internal',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ti_workspace ON training_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ti_status    ON training_interactions(workspace_id, curator_status);
CREATE INDEX IF NOT EXISTS idx_ti_eligible  ON training_interactions(workspace_id, eligible_for_training);

-- Training batches: cada ciclo de fine-tuning LoRA
CREATE TABLE IF NOT EXISTS training_batches (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id           UUID NOT NULL,
    base_model             TEXT NOT NULL DEFAULT 'llama3.1:8b',
    previous_lora_version  TEXT,
    new_lora_version       TEXT,
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
    total_examples         INT,
    positive_examples      INT,
    corrected_examples     INT,
    progress               INT DEFAULT 0,
    current_epoch          INT,
    total_epochs           INT,
    training_loss          FLOAT8,
    eval_accuracy          FLOAT8,
    -- Referencia no servico externo de treinamento
    external_job_id        TEXT,
    external_service_url   TEXT,
    error_message          TEXT,
    -- Timestamps
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at             TIMESTAMPTZ,
    completed_at           TIMESTAMPTZ,
    deployed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tb_workspace ON training_batches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tb_status    ON training_batches(workspace_id, status);

-- Training documents: pares QA sinteticos gerados a partir de chunks
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
