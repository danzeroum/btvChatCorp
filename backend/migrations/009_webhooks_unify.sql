-- Unificação do modelo de webhooks (C2/B3).
--
-- Antes deste PR existiam dois modelos divergentes:
--   * crate `webhooks` (dispatch)  -> tabelas `webhooks` + `webhook_deliveries` (007, minimal)
--   * api-public (CRUD público)    -> esperava `webhook_endpoints` + um `webhook_deliveries` mais rico
--
-- Consolidamos num único modelo canônico baseado em `webhooks`/`webhook_deliveries`
-- (a tabela `webhook_endpoints` nunca existiu no schema canônico — só nas árvores
-- órfãs removidas no #70). Colunas do superconjunto são adicionadas como nullable
-- e os campos do dispatch são renomeados (preservando dados existentes) para os
-- nomes canônicos consumidos por ambos os lados.

-- ── webhooks: campos do CRUD público ────────────────────────────────────────
ALTER TABLE webhooks
    ADD COLUMN IF NOT EXISTS description           TEXT,
    ADD COLUMN IF NOT EXISTS delivery_config       JSONB,
    ADD COLUMN IF NOT EXISTS last_delivery_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_delivery_status  INTEGER,
    ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── webhook_deliveries: renomeia campos do dispatch p/ os nomes canônicos ────
ALTER TABLE webhook_deliveries RENAME COLUMN status_code TO http_status;
ALTER TABLE webhook_deliveries RENAME COLUMN attempt     TO attempt_number;

-- http_status passa a ser nullable (nem toda entrega tem resposta HTTP).
ALTER TABLE webhook_deliveries ALTER COLUMN http_status DROP NOT NULL;

-- ── webhook_deliveries: campos ricos consumidos pelo CRUD público ───────────
ALTER TABLE webhook_deliveries
    ADD COLUMN IF NOT EXISTS event_type        TEXT,
    ADD COLUMN IF NOT EXISTS response_time_ms  INTEGER,
    ADD COLUMN IF NOT EXISTS error_message     TEXT,
    ADD COLUMN IF NOT EXISTS scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_retry_at     TIMESTAMPTZ;
