import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OnboardingService } from './services/onboarding.service';

/** Número total de steps do wizard. */
const TOTAL_STEPS = 7;

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wizard-shell">
      <!-- Barra de progresso -->
      <div class="wizard-progress">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="progressPercent()"></div>
        </div>
        <span class="step-label">Passo {{ currentStep() }} de {{ totalSteps }}</span>
      </div>

      <!-- Conteúdo do step (roteado pelo router-outlet filho) -->
      <div class="wizard-body">
        <router-outlet></router-outlet>
      </div>

      <!-- Navegação -->
      <div class="wizard-nav">
        <button
          class="btn-secondary"
          (click)="back()"
          [disabled]="currentStep() === 1">
          Voltar
        </button>
        <button
          class="btn-primary"
          (click)="next()"
          [disabled]="currentStep() === totalSteps">
          {{ currentStep() === totalSteps ? 'Concluir' : 'Próximo' }}
        </button>
      </div>
    </div>
  `,
})
export class OnboardingWizardComponent implements OnInit {
  private readonly router = inject(Router);
  readonly onboarding = inject(OnboardingService);

  readonly totalSteps = TOTAL_STEPS;
  readonly currentStep = computed(() => this.onboarding.state()?.currentStep ?? 1);
  readonly progressPercent = computed(() =>
    ((this.currentStep() - 1) / this.totalSteps) * 100
  );

  async ngOnInit() {
    const workspaceId = localStorage.getItem('workspace_id') ?? '';
    await this.onboarding.load(workspaceId);
    this.navigateToStep(this.currentStep());
  }

  next() {
    const next = this.currentStep() + 1;
    if (next > this.totalSteps) {
      this.onboarding.complete();
      this.router.navigate(['/']);
      return;
    }
    this.navigateToStep(next);
  }

  back() {
    const prev = this.currentStep() - 1;
    if (prev >= 1) this.navigateToStep(prev);
  }

  private navigateToStep(step: number) {
    const routes: Record<number, string> = {
      1: 'workspace',
      2: 'branding',
      3: 'auth',
      4: 'first-project',
      5: 'documents',
      6: 'test-chat',
      7: 'invite-team',
    };
    this.router.navigate(['/onboarding', routes[step]]);
  }
}
