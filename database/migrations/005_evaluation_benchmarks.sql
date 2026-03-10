-- Benchmarks de avaliação automática do modelo por workspace
-- Executar após 004_sso_branding.sql

CREATE TABLE evaluation_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Pergunta e resposta esperada
    question TEXT NOT NULL,
    expected_answer TEXT,
    acceptable_keywords JSONB,  -- ["palavra1", "palavra2"]
    min_keyword_match FLOAT DEFAULT 0.7,  -- 70% das keywords devem estar presentes

    -- Metadados
    category VARCHAR(100),      -- 'factual', 'reasoning', 'domain-specific'
    difficulty VARCHAR(20) DEFAULT 'medium',  -- 'easy', 'medium', 'hard'
    active BOOLEAN DEFAULT TRUE,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_benchmarks_workspace_active
    ON evaluation_benchmarks(workspace_id, active)
    WHERE active = TRUE;

-- Config do adapter LoRA ativo por workspace
CREATE TABLE workspace_ai_config (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Modelo base e adapter
    base_model VARCHAR(200) NOT NULL DEFAULT 'meta-llama/Llama-3.3-70B',
    active_lora_version VARCHAR(50),        -- 'lora_v3'
    lora_path TEXT,                          -- Caminho no filesystem
    vllm_adapter_name VARCHAR(200),          -- Nome registrado no vLLM

    -- Configurações de inferência
    default_temperature FLOAT DEFAULT 0.3,
    default_max_tokens INT DEFAULT 1024,
    default_top_k INT DEFAULT 5,
    default_top_p FLOAT DEFAULT 0.9,

    -- Treinamento
    training_enabled BOOLEAN DEFAULT TRUE,
    min_training_examples INT DEFAULT 50,
    training_schedule VARCHAR(50) DEFAULT '0 3 * * 0',  -- Domingo 3h
    last_trained_at TIMESTAMPTZ,
    next_training_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspace_ai_config_updated_at
    BEFORE UPDATE ON workspace_ai_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmarks_updated_at
    BEFORE UPDATE ON evaluation_benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Adiciona coluna qa_generated em document_chunks (necessária para generate_synthetic_qa.py)
ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS qa_generated BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_chunks_qa_pending
    ON document_chunks(workspace_id, qa_generated)
    WHERE qa_generated = FALSE;

COMMENT ON TABLE evaluation_benchmarks IS 'Perguntas de referencia para avaliacao automatica do LoRA antes do deploy';
COMMENT ON TABLE workspace_ai_config IS 'Configuracao do modelo e adapter LoRA ativo por workspace';
