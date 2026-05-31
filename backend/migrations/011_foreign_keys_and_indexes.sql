-- Migration 011: Foreign key faltante em api_keys.workspace_id
--
-- As FKs e indices por workspace de documents, projects, chats e messages JA
-- existem inline nas migrations 001 (core) e 003 (training). Replica-los aqui
-- era redundante — e, no caso das FKs, ativamente nocivo: a versao anterior desta
-- migration adicionava uma 2a FK ON DELETE RESTRICT sobre a mesma coluna que ja
-- tinha uma FK ON DELETE CASCADE inline, o que anularia o CASCADE (o RESTRICT
-- bloquearia o delete do workspace).
--
-- A unica integridade genuinamente ausente era em api_keys: a migration 008
-- criou a coluna workspace_id SEM clausula REFERENCES. Esta migration adiciona
-- apenas essa FK, de forma idempotente (guardada por DO-block), seguindo a
-- convencao ON DELETE CASCADE usada pelas demais tabelas filhas de workspace.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_keys_workspace'
    ) THEN
        ALTER TABLE api_keys
            ADD CONSTRAINT fk_api_keys_workspace
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
