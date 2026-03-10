import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../services/onboarding.service';

@Component({
  selector: 'app-step-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-workspace">
      <div class="step-header">
        <span class="step-emoji">&#127970;</span>
        <h2>Crie seu workspace</h2>
        <p>Vamos configurar o espa\xE7o da sua empresa na plataforma.</p>
      </div>

      <div class="form-group">
        <label>Nome da empresa *
          <input [(ngModel)]="data.workspaceName"
            placeholder="Ex: Acme Corp"
            (ngModelChange)="autoSlug($event)"
            autofocus />
        </label>
      </div>

      <div class="form-group">
        <label>Subdom\xEDnio *
          <div class="subdomain-row">
            <input [(ngModel)]="data.subdomain"
              placeholder="acme"
              (ngModelChange)="save()" />
            <span class="subdomain-suffix">.aiplatform.com</span>
          </div>
        </label>
        <span class="hint">Ser\xE1 o endere\xE7o de acesso da sua equipe.</span>
      </div>

      <div class="form-group">
        <label>Seu nome *
          <input [(ngModel)]="data.adminName" placeholder="Maria Silva" (ngModelChange)="save()" />
        </label>
      </div>

      <div class="form-group">
        <label>Email *
          <input [(ngModel)]="data.adminEmail" type="email" placeholder="maria@empresa.com.br" (ngModelChange)="save()" />
        </label>
      </div>

      <div class="form-group">
        <label>Senha *
          <input [(ngModel)]="data.adminPassword" type="password" placeholder="M\xEDnimo 12 caracteres" (ngModelChange)="save()" />
        </label>
      </div>
    </div>
  `
})
export class StepWorkspaceComponent {
  private onboardingService = inject(OnboardingService);

  data = {
    workspaceName: '',
    subdomain: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  };

  autoSlug(name: string): void {
    this.data.subdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    this.save();
  }

  save(): void {
    this.onboardingService.updateState({ workspace: this.data });
  }
}
