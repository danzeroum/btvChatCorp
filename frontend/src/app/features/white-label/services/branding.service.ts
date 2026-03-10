import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WorkspaceBranding, BrandTheme, DEFAULT_THEME } from '../models/branding.model';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);

  branding = signal<WorkspaceBranding | null>(null);

  /** Carrega branding do workspace atual e injeta CSS vars no DOM */
  load(workspaceId: string): Observable<WorkspaceBranding> {
    return this.http.get<WorkspaceBranding>(`/api/workspaces/${workspaceId}/branding`).pipe(
      tap((b) => {
        this.branding.set(b);
        this.applyCssVars(b.theme);
        this.applyFavicon(b.faviconUrl);
        this.applyPageTitle(b.platformName);
        if (b.theme.customCss) this.injectCustomCss(b.theme.customCss);
      })
    );
  }

  /** Aplica preview em tempo real sem salvar */
  previewTheme(theme: Partial<BrandTheme>): void {
    const current = this.branding()?.theme ?? DEFAULT_THEME;
    this.applyCssVars({ ...current, ...theme });
  }

  /** Salva branding no backend */
  save(workspaceId: string, branding: Partial<WorkspaceBranding>): Observable<WorkspaceBranding> {
    return this.http.patch<WorkspaceBranding>(
      `/api/workspaces/${workspaceId}/branding`,
      branding
    ).pipe(tap((b) => this.branding.set(b)));
  }

  /** Gera CSS vars a partir do tema e injeta no :root */
  private applyCssVars(theme: BrandTheme): void {
    const root = document.documentElement;
    const vars: Record<string, string> = {
      '--color-primary':          `#${theme.primary}`,
      '--color-primary-hover':    theme.primaryHover  ? `#${theme.primaryHover}`  : this.darken(theme.primary, 10),
      '--color-primary-light':    theme.primaryLight  ? `#${theme.primaryLight}`  : this.lighten(theme.primary, 40),
      '--color-secondary':        `#${theme.secondary}`,
      '--color-bg':               `#${theme.background}`,
      '--color-surface':          `#${theme.surface}`,
      '--color-surface-hover':    theme.surfaceHover  ? `#${theme.surfaceHover}`  : this.lighten(theme.surface, 5),
      '--color-sidebar-bg':       `#${theme.sidebarBg}`,
      '--color-sidebar-text':     `#${theme.sidebarText}`,
      '--color-sidebar-active':   `#${theme.sidebarActiveItem}`,
      '--color-text-primary':     `#${theme.textPrimary}`,
      '--color-text-secondary':   `#${theme.textSecondary}`,
      '--color-text-on-primary':  `#${theme.textOnPrimary}`,
      '--color-border':           `#${theme.border}`,
      '--color-border-focus':     theme.borderFocus   ? `#${theme.borderFocus}`   : `#${theme.primary}`,
      '--color-success':          `#${theme.success}`,
      '--color-warning':          `#${theme.warning}`,
      '--color-error':            `#${theme.error}`,
      '--color-info':             `#${theme.info}`,
      '--font-family':            theme.fontFamily,
      '--font-family-mono':       theme.fontFamilyMono,
      '--border-radius':          theme.borderRadius,
      '--border-radius-lg':       theme.borderRadiusLg,
      '--border-radius-full':     theme.borderRadiusFull,
    };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  private applyFavicon(url?: string): void {
    if (!url) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  private applyPageTitle(platformName: string): void {
    document.title = platformName;
  }

  private injectCustomCss(css: string): void {
    const id = 'btv-custom-css';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  /** Utilitário: escurece hex em `amount` pontos (0–255) */
  private darken(hex: string, amount: number): string {
    return this.adjustHex(hex, -amount);
  }

  private lighten(hex: string, amount: number): string {
    return this.adjustHex(hex, amount);
  }

  private adjustHex(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
