export interface WorkspaceBranding {
  id: string;
  workspaceId: string;

  // Identidade
  companyName: string;
  platformName: string;
  tagline?: string;

  // Logos
  logoUrl?: string;
  logoMarkUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;

  // Tema
  theme: BrandTheme;

  // Domínio
  subdomain: string;
  customDomain?: string;
  customDomainStatus?: 'pending_dns' | 'pending_ssl' | 'active' | 'error';
  customDomainSslExpiresAt?: string;

  // Email
  emailFromName: string;
  emailFromAddress?: string;

  // Chat
  chatWelcomeMessage: string;
  chatPlaceholder: string;
  chatBotName: string;
  chatBotAvatar?: string;

  // Login page
  loginPageTitle?: string;
  loginPageSubtitle?: string;
  loginBackgroundUrl?: string;

  // Links
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
  supportUrl?: string;

  // Feature flags
  featureFlags: FeatureFlags;

  createdAt: string;
  updatedAt: string;
}

export interface BrandTheme {
  mode: 'light' | 'dark' | 'auto';
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceHover: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveItem: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  border: string;
  borderFocus: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  fontFamily: string;
  fontFamilyMono: string;
  borderRadius: string;
  borderRadiusLg: string;
  borderRadiusFull: string;
  customCss?: string;
}

export interface FeatureFlags {
  showPoweredBy: boolean;
  showDocumentation: boolean;
  showChangelog: boolean;
  showSupportChat: boolean;
  allowUserRegistration: boolean;
}

export const DEFAULT_THEME: BrandTheme = {
  mode: 'light',
  primary: '2563EB',
  primaryHover: '',
  primaryLight: '',
  secondary: '7C3AED',
  background: 'FFFFFF',
  surface: 'F8FAFC',
  surfaceHover: 'F1F5F9',
  sidebarBg: '0F172A',
  sidebarText: 'E2E8F0',
  sidebarActiveItem: '1E40AF',
  textPrimary: '0F172A',
  textSecondary: '64748B',
  textOnPrimary: 'FFFFFF',
  border: 'E2E8F0',
  borderFocus: '2563EB',
  success: '22C55E',
  warning: 'F59E0B',
  error: 'EF4444',
  info: '3B82F6',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyMono: 'JetBrains Mono, monospace',
  borderRadius: '8px',
  borderRadiusLg: '12px',
  borderRadiusFull: '9999px',
  customCss: '',
};
