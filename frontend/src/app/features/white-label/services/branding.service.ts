import { Injectable, signal, computed, inject, APP_INITIALIZER } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WorkspaceBranding, BrandTheme } from '../models/branding.model';

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
  private readonly _branding = signal<BrandingPublicConfig | null>(null);

  readonly currentBranding = this._branding.asReadonly();

  readonly companyName  = computed(() => this._branding()?.companyName  ?? 'AI Platform');
  readonly platformName = computed(() => this._branding()?.platformName ?? 'AI Platform');
  readonly logoUrl      = computed(() => this._branding()?.logoUrl      ?? 'assets/default-logo.svg');
  readonly chatBotName  = computed(() => this._branding()?.chatBotName  ?? 'Assistente');
  readonly chatWelcome  = computed(() => this._branding()?.chatWelcomeMessage ?? 'Olá! Como posso ajudar?');

  /** Chamado no APP_INITIALIZER — carrega config antes do primeiro render. */
  async initialize(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<BrandingPublicConfig>('/branding/config.json')
      );
      this._branding.set(config);
      this.loadThemeCss();
      if (config.faviconUrl) this.updateFavicon(config.faviconUrl);
      document.title = config.platformName ?? 'AI Platform';
    } catch (e) {
      console.warn('[BrandingService] Could not load branding, using defaults', e);
    }
  }

  /** Injeta ou atualiza o link do CSS de tema no <head>. */
  private loadThemeCss(): void {
    const existing = document.getElementById('theme-css') as HTMLLinkElement | null;
    if (existing) {
      existing.href = `/branding/theme.css?t=${Date.now()}`;
    } else {
      const link = document.createElement('link');
      link.id   = 'theme-css';
      link.rel  = 'stylesheet';
      link.href = '/branding/theme.css';
      document.head.appendChild(link);
    }
  }

  /** Aplica preview de tema em tempo real via CSS vars inline. */
  applyPreviewTheme(theme: Partial<BrandTheme>): void {
    const root = document.documentElement;
    if (theme.primary) {
      root.style.setProperty('--color-primary', `#${theme.primary}`);
      root.style.setProperty('--color-primary-hover', `#${darkenColor(theme.primary, 10)}`);
      root.style.setProperty('--color-primary-light', `#${lightenColor(theme.primary, 90)}`);
    }
    if (theme.secondary)       root.style.setProperty('--color-secondary',   `#${theme.secondary}`);
    if (theme.sidebarBg)       root.style.setProperty('--color-sidebar-bg',  `#${theme.sidebarBg}`);
    if (theme.sidebarText)     root.style.setProperty('--color-sidebar-text',`#${theme.sidebarText}`);
    if (theme.fontFamily)      root.style.setProperty('--font-family', theme.fontFamily);
    if (theme.borderRadius)    root.style.setProperty('--radius', theme.borderRadius);
  }

  /** Remove estilos inline e recarrega o CSS salvo. */
  resetPreview(): void {
    document.documentElement.removeAttribute('style');
    this.loadThemeCss();
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

// ---- helpers de cor (puro TS, sem deps) ----
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

// Factory para APP_INITIALIZER
export function initializeBranding(svc: BrandingService) {
  return () => svc.initialize();
}
