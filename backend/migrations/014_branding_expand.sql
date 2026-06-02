-- ── 014_branding_expand.sql ──────────────────────────────────────────────────
-- Alinha o schema de branding_configs com o contrato WorkspaceBranding do
-- frontend: renomeia product_name → platform_name, adiciona colunas de
-- identidade/chat/email/login, consolida cores em JSONB theme e flags em
-- JSONB feature_flags, remove as colunas planas antigas.

-- Step 1: rename
ALTER TABLE branding_configs RENAME COLUMN product_name TO platform_name;

-- Step 2: new columns
ALTER TABLE branding_configs
  ADD COLUMN IF NOT EXISTS company_name         TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_mark_url        TEXT,
  ADD COLUMN IF NOT EXISTS logo_dark_url        TEXT,
  ADD COLUMN IF NOT EXISTS theme                JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subdomain            TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_from_name      TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_from_address   TEXT,
  ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT        NOT NULL DEFAULT 'Olá! Como posso ajudar?',
  ADD COLUMN IF NOT EXISTS chat_placeholder     TEXT        NOT NULL DEFAULT 'Digite sua mensagem...',
  ADD COLUMN IF NOT EXISTS chat_bot_name        TEXT        NOT NULL DEFAULT 'Assistente',
  ADD COLUMN IF NOT EXISTS chat_bot_avatar      TEXT,
  ADD COLUMN IF NOT EXISTS login_page_title     TEXT,
  ADD COLUMN IF NOT EXISTS login_page_subtitle  TEXT,
  ADD COLUMN IF NOT EXISTS login_background_url TEXT,
  ADD COLUMN IF NOT EXISTS support_url          TEXT,
  ADD COLUMN IF NOT EXISTS feature_flags        JSONB       NOT NULL DEFAULT '{}';

-- Step 3: migrate flat color columns → theme JSONB
UPDATE branding_configs
SET theme = jsonb_build_object(
  'mode',             'light',
  'primary',          primary_color,
  'primaryHover',     '',
  'primaryLight',     '',
  'secondary',        secondary_color,
  'background',       bg_color,
  'surface',          surface_color,
  'surfaceHover',     '',
  'sidebarBg',        '#0f172a',
  'sidebarText',      '#e2e8f0',
  'sidebarActiveItem','#1e40af',
  'textPrimary',      text_color,
  'textSecondary',    '#64748b',
  'textOnPrimary',    '#ffffff',
  'border',           '#e2e8f0',
  'borderFocus',      primary_color,
  'success',          '#22c55e',
  'warning',          '#f59e0b',
  'error',            '#ef4444',
  'info',             '#3b82f6',
  'fontFamily',       font_family,
  'fontFamilyMono',   'JetBrains Mono, monospace',
  'borderRadius',     '8px',
  'borderRadiusLg',   '12px',
  'borderRadiusFull', '9999px',
  'customCss',        ''
)
WHERE theme = '{}';

-- Step 4: migrate show_powered_by + features → feature_flags JSONB
UPDATE branding_configs
SET feature_flags = jsonb_build_object(
  'showPoweredBy',         show_powered_by,
  'showDocumentation',     true,
  'showChangelog',         true,
  'showSupportChat',       false,
  'allowUserRegistration', false
)
WHERE feature_flags = '{}';

-- Step 5: drop old flat columns
ALTER TABLE branding_configs
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS secondary_color,
  DROP COLUMN IF EXISTS accent_color,
  DROP COLUMN IF EXISTS bg_color,
  DROP COLUMN IF EXISTS surface_color,
  DROP COLUMN IF EXISTS text_color,
  DROP COLUMN IF EXISTS font_family,
  DROP COLUMN IF EXISTS custom_font_url,
  DROP COLUMN IF EXISTS show_powered_by,
  DROP COLUMN IF EXISTS features;
