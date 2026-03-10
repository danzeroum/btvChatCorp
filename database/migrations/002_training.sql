-- ============================================================
-- MIGRATION 002: Pipeline de treinamento contínuo
-- ============================================================

-- Interações para fine-tuning
CREATE TABLE training_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),

    -- Par pergunta/resposta
    user_message TEXT NOT NULL,
    assistant_response TEXT,

    -- Contexto RAG usado
    rag_context JSONB,
    prompt_template_version VARCHAR(50),
    model_version VARCHAR(100),

    -- Classificação
    data_classification VARCHAR(20) DEFAULT 'INTERNAL',
    pii_detected BOOLEAN DEFAULT FALSE,
    eligible_for_training BOOLEAN DEFAULT TRUE,

    -- Feedback do usuário
    user_rating VARCHAR(10) CHECK (user_rating IN ('positive', 'negative')),
    user_correction TEXT,
    feedback_categories TEXT[],
    is_high_priority BOOLEAN DEFAULT FALSE,

    -- Curadoria
    curator_status VARCHAR(20) DEFAULT 'pending'
        CHECK (curator_status IN ('pending', 'approved', 'rejected', 'used_in_training')),
    curator_id UUID REFERENCES users(id),
    curator_notes TEXT,
    curated_at TIMESTAMPTZ,

    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    training_batch_id UUID
);

CREATE INDEX idx_training_workspace_status
    ON training_interactions(workspace_id, curator_status);
CREATE INDEX idx_training_eligible
    ON training_interactions(eligible_for_training, curator_status)
    WHERE eligible_for_training = TRUE;
CREATE INDEX idx_training_positive
    ON training_interactions(workspace_id)
    WHERE user_rating = 'positive' AND curator_status = 'approved';
CREATE INDEX idx_training_high_priority
    ON training_interactions(workspace_id, is_high_priority)
    WHERE is_high_priority = TRUE;

-- Batches de treinamento
CREATE TABLE training_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),

    base_model VARCHAR(100),
    previous_lora_version VARCHAR(50),
    new_lora_version VARCHAR(50),

    total_examples INT,
    positive_examples INT,
    corrected_examples INT,
    document_examples INT,

    status VARCHAR(20) DEFAULT 'queued'
        CHECK (status IN ('queued', 'training', 'evaluating', 'deployed', 'rolled_back')),
    training_loss FLOAT,
    eval_metrics JSONB,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos para treino
CREATE TABLE training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    document_name VARCHAR(500),
    chunk_text TEXT NOT NULL,
    chunk_index INT,
    generated_question TEXT,
    generated_answer TEXT,
    classification VARCHAR(20),
    curator_status VARCHAR(20) DEFAULT 'pending',
    training_batch_id UUID REFERENCES training_batches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmarks de avaliação
CREATE TABLE evaluation_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    question TEXT NOT NULL,
    expected_answer TEXT,
    acceptable_keywords JSONB,
    active BOOLEAN DEFAULT TRUE,
    last_result BOOLEAN,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
