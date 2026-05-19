-- Sprint 4: tabelas do programa de parceiros

CREATE TABLE IF NOT EXISTS partners (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    cnpj        TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'starter'
                    CHECK (plan IN ('starter', 'growth', 'enterprise')),
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincula workspaces a parceiros (nullable para workspaces proprios do BTV)
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id),
    ADD COLUMN IF NOT EXISTS subdomain  TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'active';

-- API keys podem pertencer a parceiros OU a workspaces individuais
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id),
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- Indice para busca rapida por subdominio (roteamento nginx)
CREATE INDEX IF NOT EXISTS idx_workspaces_subdomain ON workspaces (subdomain);
CREATE INDEX IF NOT EXISTS idx_api_keys_partner ON api_keys (partner_id);

COMMENT ON TABLE partners IS 'Parceiros do programa white-label BTV';
COMMENT ON COLUMN workspaces.subdomain IS 'Subdominio unico: <subdomain>.btvc.com';
COMMENT ON COLUMN workspaces.partner_id IS 'Parceiro responsavel pelo workspace';
