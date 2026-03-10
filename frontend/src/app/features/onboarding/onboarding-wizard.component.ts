import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OnboardingService } from './services/onboarding.service';
import { OnboardingState } from './models/onboarding-state.model';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-wizard">
      <!-- Steps indicator -->
      <div class="steps-bar">
        @for (step of steps; track step.id; let i = $index) {
          <div class="step"
            [class.active]="currentStep() === i"
            [class.completed]="currentStep() > i">
            <span class="step-number">{{ currentStep() > i ? '\u2713' : i + 1 }}</span>
            <span class="step-label">{{ step.label }}</span>
          </div>
        }
      </div>

      <!-- Progress bar -->
      <div class="wizard-progress">
        <div class="progress-fill"
          [style.width.%]="((currentStep() + 1) / steps.length) * 100">
        </div>
      </div>

      <!-- Step content (lazy por ngSwitch) -->
      <div class="step-content">
        <ng-content></ng-content>
      </div>

      <!-- Navigation -->
      <div class="wizard-nav">
        @if (currentStep() > 0) {
          <button class="btn-back" (click)="back()">&#8592; Voltar</button>
        }
        <span class="step-counter">{{ currentStep() + 1 }} / {{ steps.length }}</span>
        <button
          class="btn-next"
          (click)="next()"
          [disabled]="saving()">
          {{ currentStep() === steps.length - 1 ? (saving() ? 'Finalizando...' : '\uD83C\uDF89 Concluir Setup') : 'Pr\xF3ximo \u2192' }}
        </button>
      </div>
    </div>
  `
})
export class OnboardingWizardComponent implements OnInit {
  private onboardingService = inject(OnboardingService);
  private router = inject(Router);

  currentStep = signal(0);
  saving = signal(false);

  steps = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'branding',  label: 'Identidade' },
    { id: 'auth',      label: 'Acesso' },
    { id: 'project',   label: 'Projeto' },
    { id: 'documents', label: 'Documentos' },
    { id: 'test',      label: 'Testar IA' },
    { id: 'team',      label: 'Equipe' },
  ];

  state!: OnboardingState;

  ngOnInit(): void {
    this.state = this.onboardingService.getState();
    this.currentStep.set(this.state.currentStep);
  }

  next(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.onboardingService.completeStep(this.currentStep());
      this.currentStep.update((s) => s + 1);
    } else {
      this.finish();
    }
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
    }
  }

  private finish(): void {
    this.saving.set(true);
    this.onboardingService.complete().subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.saving.set(false),
    });
  }
}
