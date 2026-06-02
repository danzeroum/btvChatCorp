-- =============================================
-- Migration 013: Admin tables
-- Creates all tables required by admin_service.rs
-- =============================================

-- ─── Extra columns for users ─────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled     BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status          TEXT        NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','suspended','invited','pending'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id         UUID;

-- ─── Roles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  is_system     BOOLEAN     NOT NULL DEFAULT FALSE,
  permissions   JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, name, description, is_system, permissions)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin',   'Acesso administrativo completo', TRUE, '{"workspace":["manage","view"]}'),
  ('00000000-0000-0000-0000-000000000002', 'Curador', 'Gerencia documentos e projetos',  TRUE, '{"documents":["read","write"],"projects":["read","write"]}'),
  ('00000000-0000-0000-0000-000000000003', 'Membro',  'Usa chat e projetos atribuídos',  TRUE, '{"chat":["read","write"]}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_role_id
  FOREIGN KEY (role_id) REFERENCES roles(id);

UPDATE users u
   SET role_id = r.id
  FROM roles r
 WHERE r.name = u.role
   AND r.is_system = TRUE
   AND u.role_id IS NULL;

-- ─── Workspace settings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id                UUID        PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  name                        TEXT        NOT NULL DEFAULT 'Workspace',
  slug                        TEXT,
  timezone                    TEXT        NOT NULL DEFAULT 'America/Sao_Paulo',
  language                    TEXT        NOT NULL DEFAULT 'pt-BR',
  session_timeout_minutes     INT         NOT NULL DEFAULT 480,
  max_concurrent_sessions     INT         NOT NULL DEFAULT 5,
  mfa_required                BOOLEAN     NOT NULL DEFAULT FALSE,
  notify_on_new_user          BOOLEAN     NOT NULL DEFAULT TRUE,
  notify_on_training_complete BOOLEAN     NOT NULL DEFAULT TRUE,
  notify_on_security_event    BOOLEAN     NOT NULL DEFAULT TRUE,
  notification_email          TEXT,
  allow_user_self_registration BOOLEAN   NOT NULL DEFAULT FALSE,
  auto_training_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  data_retention_days         INT         NOT NULL DEFAULT 90,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workspace_settings (workspace_id, name, slug)
SELECT id, name, slug FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ─── Branding configs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branding_configs (
  workspace_id          UUID        PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  product_name          TEXT        NOT NULL DEFAULT 'Chat AI',
  tagline               TEXT        NOT NULL DEFAULT '',
  logo_url              TEXT,
  favicon_url           TEXT,
  primary_color         TEXT        NOT NULL DEFAULT '#6366f1',
  secondary_color       TEXT        NOT NULL DEFAULT '#0f172a',
  accent_color          TEXT        NOT NULL DEFAULT '#a5b4fc',
  bg_color              TEXT        NOT NULL DEFAULT '#f8fafc',
  surface_color         TEXT        NOT NULL DEFAULT '#ffffff',
  text_color            TEXT        NOT NULL DEFAULT '#0f172a',
  font_family           TEXT        NOT NULL DEFAULT 'Inter',
  custom_font_url       TEXT,
  custom_domain         TEXT,
  custom_domain_status  TEXT        NOT NULL DEFAULT 'pending',
  show_powered_by       BOOLEAN     NOT NULL DEFAULT TRUE,
  terms_url             TEXT,
  privacy_url           TEXT,
  support_email         TEXT,
  features              JSONB       NOT NULL DEFAULT '{"showTrainingSection":true,"showBillingSection":true,"showApiKeys":true,"showAuditLog":true}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO branding_configs (workspace_id)
SELECT id FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ─── RAG configs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_configs (
  workspace_id          UUID           PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  top_k                 INT            NOT NULL DEFAULT 5,
  chunk_size            INT            NOT NULL DEFAULT 512,
  chunk_overlap         INT            NOT NULL DEFAULT 50,
  similarity_threshold  NUMERIC(4,3)   NOT NULL DEFAULT 0.750,
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

INSERT INTO rag_configs (workspace_id)
SELECT id FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ─── AI model configs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id                    TEXT        PRIMARY KEY,
  workspace_id          UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name          TEXT        NOT NULL,
  base_model            TEXT,
  inference_url         TEXT,
  status                TEXT        NOT NULL DEFAULT 'active',
  default_temperature   NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  default_max_tokens    INT         NOT NULL DEFAULT 2048,
  context_window_size   INT         NOT NULL DEFAULT 4096,
  avg_latency_ms        BIGINT      NOT NULL DEFAULT 0,
  requests_per_minute   INT         NOT NULL DEFAULT 0,
  gpu_utilization       NUMERIC(5,2) NOT NULL DEFAULT 0,
  active_lora_version   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LoRA adapters ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lora_adapters (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  version                   TEXT        NOT NULL,
  path                      TEXT,
  trained_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  training_examples         INT         NOT NULL DEFAULT 0,
  training_loss             NUMERIC(8,6),
  eval_accuracy             NUMERIC(5,4),
  status                    TEXT        NOT NULL DEFAULT 'ready',
  deployed_at               TIMESTAMPTZ,
  improvement_vs_previous   NUMERIC(5,2)
);

-- ─── Resource limits ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_limits (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  type                     TEXT        NOT NULL,
  target_name              TEXT        NOT NULL,
  max_tokens_per_day       BIGINT,
  max_messages_per_day     INT,
  max_documents_total      INT,
  max_storage_gb           NUMERIC(10,2),
  max_api_requests_per_min INT,
  current_tokens_today     BIGINT      NOT NULL DEFAULT 0,
  current_messages_today   INT         NOT NULL DEFAULT 0,
  current_documents_total  INT         NOT NULL DEFAULT 0,
  current_storage_gb       NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Retention policies ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retention_policies (
  workspace_id        UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  data_type           TEXT        NOT NULL,
  retention_days      INT         NOT NULL DEFAULT 90,
  auto_delete_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  last_purge_at       TIMESTAMPTZ,
  next_purge_at       TIMESTAMPTZ,
  current_size_gb     NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_count          BIGINT      NOT NULL DEFAULT 0,
  purgeable           BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, data_type)
);

INSERT INTO retention_policies (workspace_id, data_type)
SELECT w.id, d.data_type
FROM workspaces w
CROSS JOIN (VALUES ('chats'), ('documents'), ('audit_logs'), ('training_data')) AS d(data_type)
ON CONFLICT (workspace_id, data_type) DO NOTHING;

-- ─── Deletion requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL,
  requested_by  UUID        REFERENCES users(id),
  target_name   TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  items_deleted BIGINT
);

-- ─── Sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  ip_address    TEXT,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_roles_workspace ON roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lora_adapters_workspace ON lora_adapters(workspace_id, trained_at DESC);
