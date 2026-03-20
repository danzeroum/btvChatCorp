import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { WorkspaceBranding, BrandTheme, DEFAULT_THEME } from '../models/branding.model';

export interface BrandingPublicConfig {
  companyName: string;
  platformName: string;
  tagline?: string;
  logoUrl?: string;
  logomarkUrl?: string;
  faviconUrl?: string;
  chatWelcomeMessage: string;
  chatPlaceholder: string;
  chatBotName: string;
  chatBotAvatar?: string;
  loginPageTitle?: string;
  loginPageSubtitle?: string;
  loginBackgroundUrl?: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportEmail?: string;
  featureFlags: Record<string, boolean>;
}

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly http = inject(HttpClient);

  // Config publica (APP_INITIALIZER)
  private readonly _publicConfig = signal<BrandingPublicConfig | null>(null);
  readonly currentBranding = this._publicConfig.asReadonly();
  readonly companyName  = computed(() => this._publicConfig()?.companyName  ?? 'AI Platform');
  readonly platformName = computed(() => this._publicConfig()?.platformName ?? 'AI Platform');
  readonly logoUrl      = computed(() => this._publicConfig()?.logoUrl      ?? 'assets/default-logo.svg');
  readonly chatBotName  = computed(() => this._publicConfig()?.chatBotName  ?? 'Assistente');
  readonly chatWelcome  = computed(() => this._publicConfig()?.chatWelcomeMessage ?? 'Olá! Como posso ajudar?');

  // Config admin completa (painel)
  private readonly _adminBranding = signal<WorkspaceBranding | null>(null);
  readonly branding = this._adminBranding.asReadonly();

  // --- APP_INITIALIZER ---

  async initialize(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<BrandingPublicConfig>('/api/v1/branding/config.json')
      );
      this._publicConfig.set(config);
      this.loadThemeCss();
      if (config.faviconUrl) this.updateFavicon(config.faviconUrl);
      document.title = config.platformName ?? 'AI Platform';
    } catch (e) {
      console.warn('[BrandingService] Could not load branding, using defaults', e);
    }
  }

  // --- Admin API ---
  // Endpoints: GET /api/v1/admin/branding  |  PUT /api/v1/admin/branding

  loadAdminBranding(): Observable<WorkspaceBranding> {
    return this.http.get<WorkspaceBranding>('/api/v1/admin/branding').pipe(
      tap(b => this._adminBranding.set(b))
    );
  }

  save(_workspaceId: string, data: WorkspaceBranding): Observable<WorkspaceBranding> {
    return this.http.put<WorkspaceBranding>('/api/v1/admin/branding', data).pipe(
      tap(b => {
        this._adminBranding.set(b);
        this.loadThemeCss();
      })
    );
  }

  /** Preview de tema em tempo real via CSS vars inline. */
  previewTheme(theme: Partial<BrandTheme>): void {
    const root = document.documentElement;
    if (theme.primary) {
      root.style.setProperty('--color-primary', `#${theme.primary}`);
      root.style.setProperty('--color-primary-hover', `#${darkenColor(theme.primary, 10)}`);
      root.style.setProperty('--color-primary-light', `#${lightenColor(theme.primary, 90)}`);
    }
    if (theme.secondary)    root.style.setProperty('--color-secondary',    `#${theme.secondary}`);
    if (theme.background)   root.style.setProperty('--color-bg',           `#${theme.background}`);
    if (theme.surface)      root.style.setProperty('--color-surface',      `#${theme.surface}`);
    if (theme.sidebarBg)    root.style.setProperty('--color-sidebar-bg',   `#${theme.sidebarBg}`);
    if (theme.sidebarText)  root.style.setProperty('--color-sidebar-text', `#${theme.sidebarText}`);
    if (theme.textPrimary)  root.style.setProperty('--color-text',         `#${theme.textPrimary}`);
    if (theme.fontFamily)   root.style.setProperty('--font-family',  theme.fontFamily);
    if (theme.borderRadius) root.style.setProperty('--radius',        theme.borderRadius);
    if (theme.customCss)    this.injectCustomCss(theme.customCss);
  }

  /** Alias para compatibilidade. */
  applyPreviewTheme(theme: Partial<BrandTheme>): void {
    this.previewTheme(theme);
  }

  resetPreview(): void {
    document.documentElement.removeAttribute('style');
    const custom = document.getElementById('custom-css-preview');
    if (custom) custom.remove();
    this.loadThemeCss();
  }

  // --- Privados ---

  private loadThemeCss(): void {
    const existing = document.getElementById('theme-css') as HTMLLinkElement | null;
    if (existing) {
      existing.href = `/api/v1/branding/theme.css?t=${Date.now()}`;
    } else {
      const link = document.createElement('link');
      link.id   = 'theme-css';
      link.rel  = 'stylesheet';
      link.href = '/api/v1/branding/theme.css';
      document.head.appendChild(link);
    }
  }

  private injectCustomCss(css: string): void {
    let el = document.getElementById('custom-css-preview') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'custom-css-preview';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  private updateFavicon(url: string): void {
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}

function darkenColor(hex: string, pct: number): string {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return '000000';
  const f = (1 - pct / 100);
  const r = Math.round(parseInt(hex.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(hex.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(hex.slice(4, 6), 16) * f);
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function lightenColor(hex: string, pct: number): string {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return 'FFFFFF';
  const f = pct / 100;
  const r = Math.round(parseInt(hex.slice(0, 2), 16) + (255 - parseInt(hex.slice(0, 2), 16)) * f);
  const g = Math.round(parseInt(hex.slice(2, 4), 16) + (255 - parseInt(hex.slice(2, 4), 16)) * f);
  const b = Math.round(parseInt(hex.slice(4, 6), 16) + (255 - parseInt(hex.slice(4, 6), 16)) * f);
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function initializeBranding(svc: BrandingService) {
  return () => svc.initialize();
}
