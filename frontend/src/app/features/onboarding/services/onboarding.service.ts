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

  /** Faz merge parcial dos dados coletados (collectedData) no estado local, sem persistir.
   *  Chamado pelos componentes step-* para refletir mudancas de UI antes do advanceStep. */
  updateState(partial: Partial<OnboardingState['collectedData']>): void {
    const current = this._state();
    if (current) {
      this._state.set({
        ...current,
        collectedData: { ...current.collectedData, ...partial },
      });
    }
  }

  /** Retorna o snapshot atual do estado do onboarding (ou null se ainda nao carregado). */
  getState(): OnboardingState | null {
    return this._state();
  }

  /** Registra no estado local o id de um documento enviado no step de documentos. */
  addUploadedDoc(documentId: string): void {
    const current = this._state();
    if (!current) return;
    const existing = current.collectedData.documents?.uploadedIds ?? [];
    this._state.set({
      ...current,
      collectedData: {
        ...current.collectedData,
        documents: {
          ...current.collectedData.documents,
          uploadedIds: [...new Set([...existing, documentId])],
        },
      },
    });
  }
}
