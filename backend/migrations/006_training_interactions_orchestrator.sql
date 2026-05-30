-- Colunas adicionais em training_interactions usadas pelo ai-orchestrator
-- (geração de resposta + coleta de telemetria de treino). Todas aditivas e
-- nullable (ou com default) para não quebrar inserts existentes do crate `api`.

ALTER TABLE training_interactions
    ADD COLUMN IF NOT EXISTS rag_context       JSONB,
    ADD COLUMN IF NOT EXISTS pii_detected      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS model_version     TEXT,
    ADD COLUMN IF NOT EXISTS project_id        UUID,
    ADD COLUMN IF NOT EXISTS prompt_tokens     INTEGER,
    ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS curator_priority  TEXT,
    ADD COLUMN IF NOT EXISTS curator_notes     TEXT;
