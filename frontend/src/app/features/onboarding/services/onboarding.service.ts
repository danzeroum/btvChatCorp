import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OnboardingState } from '../models/onboarding-state.model';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private http = inject(HttpClient);
  private state: OnboardingState = this.loadState();

  getState(): OnboardingState {
    return this.state;
  }

  updateState(partial: Partial<OnboardingState>): void {
    this.state = { ...this.state, ...partial };
    this.persistState();
  }

  completeStep(step: number): void {
    const completed = new Set(this.state.completedSteps ?? []);
    completed.add(step);
    this.state = {
      ...this.state,
      currentStep: step + 1,
      completedSteps: Array.from(completed),
    };
    this.persistState();
    // Sincroniza com backend
    this.http.post(`/api/onboarding/progress`, { step, data: this.state }).subscribe();
  }

  addUploadedDoc(docId: string): void {
    const ids = this.state.documents?.uploadedIds ?? [];
    this.updateState({ documents: { uploadedIds: [...ids, docId] } });
  }

  complete(): Observable<{ workspaceId: string }> {
    return this.http.post<{ workspaceId: string }>('/api/onboarding/complete', this.state);
  }

  private loadState(): OnboardingState {
    try {
      const raw = localStorage.getItem('btv_onboarding_state');
      return raw ? JSON.parse(raw) : { currentStep: 0, completedSteps: [] };
    } catch {
      return { currentStep: 0, completedSteps: [] };
    }
  }

  private persistState(): void {
    localStorage.setItem('btv_onboarding_state', JSON.stringify(this.state));
  }
}
