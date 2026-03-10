import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  autoAnonymize: boolean;
  sensitiveKeywords: string[];
  activeProjectId: string | null;
  activeLoraVersion: string | null;
  sector: string;             // 'legal', 'health', 'hr', 'generic'
  dataRetentionDays: number;
  allowTraining: boolean;
  branding: WorkspaceBranding;
}

export interface WorkspaceBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  displayName: string;
  faviconUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private _context = signal<WorkspaceContext | null>(null);

  readonly context = this._context.asReadonly();
  readonly isLoaded = computed(() => this._context() !== null);

  // Atalhos computados
  readonly workspaceId = computed(() => this._context()?.workspaceId ?? '');
  readonly autoAnonymize = computed(() => this._context()?.autoAnonymize ?? true);
  readonly sector = computed(() => this._context()?.sector ?? 'generic');
  readonly allowTraining = computed(() => this._context()?.allowTraining ?? true);
  readonly branding = computed(() => this._context()?.branding ?? null);

  constructor(private http: HttpClient) {}

  /** Carrega o contexto do workspace após login */
  load(workspaceId: string): Observable<WorkspaceContext> {
    return this.http
      .get<WorkspaceContext>(`/api/workspaces/${workspaceId}/context`)
      .pipe(tap((ctx) => this.setContext(ctx)));
  }

  setContext(ctx: WorkspaceContext): void {
    this._context.set(ctx);
    // Aplica branding CSS imediatamente
    this.applyBranding(ctx.branding);
  }

  updateActiveProject(projectId: string): void {
    this._context.update((ctx) =>
      ctx ? { ...ctx, activeProjectId: projectId } : ctx
    );
  }

  clear(): void {
    this._context.set(null);
  }

  /** Aplica CSS custom do workspace (white-label) */
  private applyBranding(branding: WorkspaceBranding): void {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primaryColor);
    root.style.setProperty('--color-secondary', branding.secondaryColor);

    if (branding.faviconUrl) {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) favicon.href = branding.faviconUrl;
    }

    if (branding.displayName) {
      document.title = branding.displayName;
    }
  }
}
