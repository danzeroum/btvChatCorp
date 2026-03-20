-- Migration 004: Branding e Onboarding (Fase 6)
-- Idempotente via IF NOT EXISTS

-- Branding por workspace
CREATE TABLE IF NOT EXISTS workspace_brandings (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id              UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    company_name              VARCHAR(200) NOT NULL DEFAULT 'Minha Empresa',
    platform_name             VARCHAR(200) NOT NULL DEFAULT 'AI Platform',
    tagline                   VARCHAR(500),
    -- Logos (URLs no object storage)
    logo_url                  TEXT,
    logomark_url              TEXT,
    logo_dark_url             TEXT,
    favicon_url               TEXT,
    -- Tema completo como JSON
    theme                     JSONB NOT NULL DEFAULT '{
        "mode": "light",
        "primary": "2563EB",
        "primaryHover": "",
        "primaryLight": "",
        "secondary": "7C3AED",
        "background": "FFFFFF",
        "surface": "F8FAFC",
        "surfaceHover": "F1F5F9",
        "sidebarBg": "0F172A",
        "sidebarText": "E2E8F0",
        "sidebarActiveItem": "1E40AF",
        "textPrimary": "0F172A",
        "textSecondary": "64748B",
        "textOnPrimary": "FFFFFF",
        "border": "E2E8F0",
        "borderFocus": "2563EB",
        "success": "22C55E",
        "warning": "F59E0B",
        "error": "EF4444",
        "info": "3B82F6",
        "fontFamily": "Inter, system-ui, sans-serif",
        "fontFamilyMono": "JetBrains Mono, monospace",
        "borderRadius": "8px",
        "borderRadiusLg": "12px",
        "borderRadiusFull": "9999px",
        "customCss": ""
    }',
    -- Dominio
    subdomain                 VARCHAR(63) UNIQUE NOT NULL,
    custom_domain             VARCHAR(255) UNIQUE,
    custom_domain_status      VARCHAR(20) CHECK (custom_domain_status IN ('pending_dns','pending_ssl','active','error')),
    custom_domain_ssl_expires_at TIMESTAMPTZ,
    -- Email
    email_from_name           VARCHAR(200),
    email_from_address        VARCHAR(200),
    email_logo_url            TEXT,
    email_footer_text         TEXT,
    -- Chat
    chat_welcome_message      TEXT    NOT NULL DEFAULT 'Ola! Como posso ajudar?',
    chat_placeholder          VARCHAR(200) NOT NULL DEFAULT 'Faca uma pergunta...',
    chat_bot_name             VARCHAR(100) NOT NULL DEFAULT 'Assistente',
    chat_bot_avatar           TEXT,
    -- Login page
    login_page_title          VARCHAR(200),
    login_page_subtitle       VARCHAR(500),
    login_background_url      TEXT,
    -- Links
    terms_url                 TEXT,
    privacy_url               TEXT,
    support_email             VARCHAR(200),
    support_url               TEXT,
    -- Feature flags
    feature_flags             JSONB NOT NULL DEFAULT '{"showPoweredBy":true,"showDocumentation":true,"showChangelog":true,"showSupportChat":true,"allowUserRegistration":false}',
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branding_subdomain
    ON workspace_brandings(subdomain);

CREATE INDEX IF NOT EXISTS idx_branding_custom_domain
    ON workspace_brandings(custom_domain)
    WHERE custom_domain IS NOT NULL;

-- Progresso do onboarding
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    current_step        INT  NOT NULL DEFAULT 1,
    completed_steps     INT[] NOT NULL DEFAULT '{}',
    skipped_steps       INT[] NOT NULL DEFAULT '{}',
    -- Dados coletados em cada step (JSON livre)
    collected_data      JSONB NOT NULL DEFAULT '{}',
    -- Timing
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    last_step_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Checklist pos-onboarding
    checklist_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    checklist_items     JSONB   NOT NULL DEFAULT '{}'
);

-- Convites de equipe
CREATE TABLE IF NOT EXISTS workspace_invites (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email            VARCHAR(500) NOT NULL,
    role             VARCHAR(50) NOT NULL DEFAULT 'user',
    project_ids      UUID[],
    invite_token     VARCHAR(200) UNIQUE NOT NULL,
    invited_by       UUID REFERENCES users(id),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','expired')),
    accepted_at      TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ NOT NULL,
    send_welcome_email BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invites_token
    ON workspace_invites(invite_token)
    WHERE status = 'pending';
