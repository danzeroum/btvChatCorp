import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface OnboardingState {
  workspaceId: string;
  currentStep: number;
  completedSteps: number[];
  collectedData: {
    workspace?: { name?: string; subdomain?: string };
    branding?: { logoUrl?: string; primaryColor?: string; secondaryColor?: string };
    auth?: { method?: string; domain?: string; autoProvision?: boolean };
    project?: { template?: string; name?: string; description?: string };
    documents?: { uploadedIds?: string[]; connectorConfigured?: string };
    team?: { invitedEmails?: string[] };
  };
  completedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly _state = signal<OnboardingState | null>(null);

  readonly state = this._state.asReadonly();

  async load(workspaceId: string): Promise<void> {
    const s = await firstValueFrom(
      this.http.get<OnboardingState>(`/api/onboarding/${workspaceId}`)
    );
    this._state.set(s);
  }

  async advanceStep(step: number, data: Record<string, unknown>): Promise<void> {
    const ws = this._state()?.workspaceId;
    if (!ws) return;
    await firstValueFrom(
      this.http.post(`/api/onboarding/${ws}/step/${step}`, data)
    );
    this._state.update(s => s ? {
      ...s,
      currentStep: Math.max(s.currentStep, step + 1),
      completedSteps: [...new Set([...s.completedSteps, step])],
      collectedData: { ...s.collectedData, ...data },
    } : s);
  }

  async complete(): Promise<void> {
    const ws = this._state()?.workspaceId;
    if (!ws) return;
    await firstValueFrom(this.http.post(`/api/onboarding/${ws}/complete`, {}));
  }

  isComplete(): boolean {
    return !!this._state()?.completedAt;
  }
}
