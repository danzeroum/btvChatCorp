import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../services/onboarding.service';

@Component({
  selector: 'app-step-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-auth">
      <div class="step-header">
        <span class="step-emoji">&#128274;</span>
        <h2>Autentica\xE7\xE3o</h2>
        <p>Como seus colaboradores v\xE3o acessar a plataforma?</p>
      </div>

      <div class="auth-options">
        @for (option of authOptions; track option.value) {
          <label class="auth-card" [class.selected]="data.method === option.value">
            <input type="radio"
              [(ngModel)]="data.method"
              [value]="option.value"
              (ngModelChange)="save()" />
            <span class="auth-icon">{{ option.icon }}</span>
            <div>
              <strong>{{ option.label }}</strong>
              <p>{{ option.desc }}</p>
            </div>
            @if (option.recommended) {
              <span class="recommended-badge">Recomendado</span>
            }
          </label>
        }
      </div>

      @if (data.method !== 'email' && data.method !== 'later') {
        <div class="sso-config">
          <div class="form-group">
            <label>Dom\xEDnio de email
              <input [(ngModel)]="data.domain"
                placeholder="empresa.com.br"
                (ngModelChange)="save()" />
            </label>
          </div>
          <label class="toggle-label">
            <input type="checkbox"
              [(ngModel)]="data.autoProvision"
              (ngModelChange)="save()" />
            Criar conta automaticamente no 1\xBA login
          </label>
        </div>
      }
    </div>
  `
})
export class StepAuthComponent {
  private onboardingService = inject(OnboardingService);

  data = {
    method: 'google' as string,
    domain: '',
    autoProvision: true,
  };

  authOptions = [
    { value: 'email',     icon: '\u2709\uFE0F', label: 'Email e Senha',         desc: 'Simples, sem integra\xE7\xE3o com IdP externo.', recommended: false },
    { value: 'google',    icon: '\uD83D\uDD35', label: 'Google Workspace',      desc: 'Login com contas @empresa.com.br do Google.',   recommended: true  },
    { value: 'microsoft', icon: '\uD83D\uDCA0', label: 'Microsoft 365 / Entra', desc: 'Login com contas corporativas Microsoft.',       recommended: false },
    { value: 'saml',      icon: '\uD83D\uDD10', label: 'SAML 2.0',              desc: 'Okta, OneLogin, ADFS e qualquer IdP SAML.',     recommended: false },
    { value: 'later',     icon: '\u23F0',         label: 'Configurar depois',    desc: 'Use email/senha por enquanto.',                 recommended: false },
  ];

  save(): void {
    this.onboardingService.updateState({ auth: this.data });
  }
}
