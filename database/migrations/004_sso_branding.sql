-- ============================================================
-- MIGRATION 004: SSO e White-Label Branding
-- ============================================================

-- Configuração SSO por workspace
CREATE TABLE sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) UNIQUE,
    provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('oidc', 'saml', 'ldap', 'google', 'microsoft')),

    -- OIDC
    issuer_url TEXT,
    client_id VARCHAR(500),
    client_secret_hash VARCHAR(128),
    scopes TEXT[],

    -- SAML
    idp_metadata_url TEXT,
    sp_entity_id TEXT,
    attribute_mapping JSONB,

    -- LDAP
    server_url TEXT,
    bind_dn TEXT,
    user_search_base TEXT,
    user_filter TEXT,

    -- Mapeamento de grupos → roles
    role_mappings JSONB DEFAULT '[]',
    auto_provision BOOLEAN DEFAULT TRUE,

    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branding / White-Label por workspace
CREATE TABLE workspace_brandings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) UNIQUE,

    company_name VARCHAR(200),
    platform_name VARCHAR(200),
    tagline VARCHAR(500),

    -- Logos
    logo_url TEXT,
    logo_mark_url TEXT,
    logo_dark_url TEXT,
    favicon_url TEXT,

    -- Tema de cores
    theme JSONB DEFAULT '{}',

    -- Domínio customizado
    custom_domain VARCHAR(253),
    custom_domain_status VARCHAR(20) DEFAULT 'pending_dns',

    -- Chat
    chat_bot_name VARCHAR(100) DEFAULT 'Assistente',
    chat_welcome_message TEXT,
    chat_placeholder VARCHAR(200),

    -- Flags de funcionalidades
    feature_flags JSONB DEFAULT '{"showPoweredBy": true, "showDocumentation": true}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(200),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    details JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_workspace_date ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_severity ON audit_logs(severity, created_at DESC);
