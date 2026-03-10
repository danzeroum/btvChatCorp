import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  autoAnonymize: boolean;
  sensitiveKeywords: string[];
  activeProjectId: string | null;
  activeLoraVersion: string;
  modelConfig: {
    temperature: number;
    maxTokens: number;
    topK: number;
  };
  branding: {
    logoUrl: string;
    primaryColor: string;
    displayName: string;
  };
  features: {
    trainingEnabled: boolean;
    apiAccessEnabled: boolean;
    ssoEnabled: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private contextSubject = new BehaviorSubject<WorkspaceContext | null>(null);
  context$ = this.contextSubject.asObservable();

  get context(): WorkspaceContext | null {
    return this.contextSubject.value;
  }

  load(): Observable<WorkspaceContext> {
    return this.http.get<WorkspaceContext>('/api/workspace/context').pipe(
      tap(ctx => {
        this.contextSubject.next(ctx);
        this.applyBranding(ctx.branding);
      })
    );
  }

  setActiveProject(projectId: string): void {
    const ctx = this.context;
    if (ctx) {
      this.contextSubject.next({ ...ctx, activeProjectId: projectId });
    }
  }

  private applyBranding(branding: WorkspaceContext['branding']): void {
    document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link && branding.logoUrl) link.href = branding.logoUrl;
    document.title = branding.displayName || 'AI Platform';
  }
}
