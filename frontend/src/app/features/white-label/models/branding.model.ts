export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface BrandTheme {
  mode: 'light' | 'dark' | 'auto';
  // Cores principais
  primary: string;           // ex: '2563EB'
  primaryHover?: string;     // calculado se vazio
  primaryLight?: string;
  secondary: string;         // ex: '7C3AED'
  // Superfícies
  background: string;        // 'FFFFFF'
  surface: string;           // 'F8FAFC'
  surfaceHover?: string;
  // Sidebar
  sidebarBg: string;         // '0F172A'
  sidebarText: string;       // 'E2E8F0'
  sidebarActiveItem: string; // '1E40AF'
  // Texto
  textPrimary: string;       // '0F172A'
  textSecondary: string;     // '64748B'
  textOnPrimary: string;     // 'FFFFFF'
  // Bordas
  border: string;            // 'E2E8F0'
  borderFocus?: string;
  // Status
  success: string;           // '22C55E'
  warning: string;           // 'F59E0B'
  error: string;             // 'EF4444'
  info: string;              // '3B82F6'
  // Tipografia
  fontFamily: string;
  fontFamilyMono: string;
  // Border radius
  borderRadius: string;      // '8px'
  borderRadiusLg: string;    // '12px'
  borderRadiusFull: string;  // '9999px'
  // CSS override avançado
  customCss?: string;
}

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
  // Cores
  theme: BrandTheme;
  // Domínio
  subdomain: string;
  customDomain?: string;
  customDomainStatus?: 'pending_dns' | 'pending_ssl' | 'active' | 'error';
  customDomainSslExpiresAt?: string;
  // Emails
  emailFromName: string;
  emailFromAddress?: string;
  emailLogoUrl?: string;
  emailFooterText?: string;
  // Chat
  chatWelcomeMessage: string;
  chatPlaceholder: string;
  chatBotName: string;
  chatBotAvatar?: string;
  // Login page
  loginPageTitle?: string;
  loginPageSubtitle?: string;
  loginBackgroundUrl?: string;
  // Footer/Legal
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
  supportUrl?: string;
  // Feature flags
  featureFlags: {
    showPoweredBy: boolean;
    showDocumentation: boolean;
    showChangelog: boolean;
    showSupportChat: boolean;
    allowUserRegistration: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_THEME: BrandTheme = {
  mode: 'light',
  primary: '2563EB',
  secondary: '7C3AED',
  background: 'FFFFFF',
  surface: 'F8FAFC',
  sidebarBg: '0F172A',
  sidebarText: 'E2E8F0',
  sidebarActiveItem: '1E40AF',
  textPrimary: '0F172A',
  textSecondary: '64748B',
  textOnPrimary: 'FFFFFF',
  border: 'E2E8F0',
  success: '22C55E',
  warning: 'F59E0B',
  error: 'EF4444',
  info: '3B82F6',
  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilyMono: "JetBrains Mono, monospace",
  borderRadius: '8px',
  borderRadiusLg: '12px',
  borderRadiusFull: '9999px',
};
