-- Migration 011: Foreign keys e índices para integridade referencial e performance
--
-- ATENÇÃO: Aplicar primeiro em staging com dump real de produção.
-- Usar ON DELETE RESTRICT na primeira versão; migrar para CASCADE apenas
-- após validar que não há registros órfãos e que o comportamento em cascata
-- é o desejado para cada tabela.

-- ── Foreign Keys ───────────────────────────────────────────────────────────────

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

ALTER TABLE chats
  ADD CONSTRAINT fk_chats_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_chat
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;

ALTER TABLE api_keys
  ADD CONSTRAINT fk_api_keys_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

-- ── Índices para queries frequentes ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_workspace
  ON documents(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_workspace
  ON chats(workspace_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(chat_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_training_ws
  ON training_interactions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_audit_ws
  ON audit_logs(workspace_id, created_at DESC);
