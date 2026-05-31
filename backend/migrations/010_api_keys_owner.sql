-- Migration 010: dono da API key
-- ----------------------------------------------------------------------------
-- A API Pública (`api-public`) autentica por API key, que carrega apenas o
-- `workspace_id` — não há usuário humano. Como `projects.created_by` é
-- `NOT NULL REFERENCES users(id)`, a criação de projetos sob API key ficava
-- bloqueada (TODO `C2-writes`). Damos um dono à API key: o handler de criação
-- usa este `created_by` como autor do projeto.

ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill: associa as keys existentes ao owner do respectivo workspace.
-- O schema de `users` usa a coluna `role TEXT` (owner/admin/member/viewer);
-- não existe tabela `roles`/`role_id`.
UPDATE api_keys k
SET created_by = (
    SELECT u.id
    FROM users u
    WHERE u.workspace_id = k.workspace_id
      AND u.role = 'owner'
    ORDER BY u.created_at
    LIMIT 1
)
WHERE k.created_by IS NULL;
