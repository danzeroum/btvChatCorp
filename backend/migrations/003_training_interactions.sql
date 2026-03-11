-- Toda interação salva para possível uso em treinamento
CREATE TABLE IF NOT EXISTS training_interactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id           UUID,

    -- Par pergunta/resposta
    user_message         TEXT NOT NULL,
    assistant_response   TEXT,

    -- Contexto RAG usado (para reprodutibilidade)
    rag_context          JSONB,

    -- Metadados de geração
    model_version        VARCHAR(100),   -- ex: "llama-3.3-70b-lora_v3"
    prompt_tokens        INT,
    completion_tokens    INT,

    -- Classificação de dados
    data_classification  VARCHAR(20) DEFAULT 'INTERNAL',
    pii_detected         BOOLEAN DEFAULT FALSE,
    eligible_for_training BOOLEAN DEFAULT TRUE,

    -- Feedback do usuário
    user_rating          VARCHAR(10),
    user_correction      TEXT,
    feedback_categories  TEXT,

    -- Curadoria admin
    curator_status       VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected | used_in_training
    curator_priority     VARCHAR(10) DEFAULT 'normal',   -- normal | high
    curator_id           UUID REFERENCES users(id),
    curator_notes        TEXT,
    curated_at           TIMESTAMPTZ,

    -- Batch de treino
    training_batch_id    UUID,

    created_at           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_rating CHECK (user_rating IN ('positive', 'negative') OR user_rating IS NULL),
    CONSTRAINT valid_curator_status CHECK (curator_status IN ('pending','approved','rejected','used_in_training'))
);

-- Índices para queries frequentes do painel de curadoria
CREATE INDEX idx_training_workspace_status
    ON training_interactions(workspace_id, curator_status);

CREATE INDEX idx_training_eligible
    ON training_interactions(eligible_for_training, curator_status)
    WHERE eligible_for_training = TRUE;

CREATE INDEX idx_training_positive_approved
    ON training_interactions(workspace_id)
    WHERE user_rating = 'positive' AND curator_status = 'approved';

CREATE INDEX idx_training_high_priority
    ON training_interactions(workspace_id, curator_priority)
    WHERE curator_priority = 'high';

-- Batches de treinamento
CREATE TABLE IF NOT EXISTS training_batches (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id),
    base_model           VARCHAR(100),
    previous_lora_version VARCHAR(50),
    new_lora_version     VARCHAR(50),
    total_examples       INT,
    positive_examples    INT,
    corrected_examples   INT,
    document_examples    INT,
    status               VARCHAR(20) DEFAULT 'queued',  -- queued | training | evaluating | deployed | rolled_back
    training_loss        FLOAT,
    eval_metrics         JSONB,
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    deployed_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- QA sintéticos gerados de documentos
CREATE TABLE IF NOT EXISTS training_documents (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id),
    document_name        VARCHAR(500),
    chunk_text           TEXT NOT NULL,
    chunk_index          INT,
    generated_question   TEXT,
    generated_answer     TEXT,
    classification       VARCHAR(20),
    curator_status       VARCHAR(20) DEFAULT 'pending',
    training_batch_id    UUID REFERENCES training_batches(id),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmarks fixos por workspace para avaliação automática de LoRA
CREATE TABLE IF NOT EXISTS evaluation_benchmarks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id),
    question             TEXT NOT NULL,
    expected_answer      TEXT NOT NULL,
    acceptable_keywords  JSONB,   -- array de palavras que devem aparecer na resposta
    active               BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);
