import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../services/onboarding.service';

@Component({
  selector: 'app-step-branding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-branding">
      <div class="step-header">
        <span class="step-emoji">&#127912;</span>
        <h2>Identidade visual</h2>
        <p>Personalize a plataforma com a cara da sua empresa.</p>
      </div>

      <div class="branding-layout">
        <div class="branding-form">
          <div class="form-group">
            <label>Nome exibido na plataforma
              <input [(ngModel)]="data.displayName" (ngModelChange)="save()" />
            </label>
          </div>

          <div class="form-group">
            <label>Logo (URL ou upload)
              <input [(ngModel)]="data.logoUrl" placeholder="https://..." (ngModelChange)="save()" />
            </label>
          </div>

          <div class="form-group">
            <label>Cor prim\xE1ria
              <div class="color-row">
                <input type="color" [(ngModel)]="data.primaryColor" (ngModelChange)="save()" />
                <input type="text" [(ngModel)]="data.primaryColor" (ngModelChange)="save()" maxlength="7" />
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>Cor secund\xE1ria
              <div class="color-row">
                <input type="color" [(ngModel)]="data.secondaryColor" (ngModelChange)="save()" />
                <input type="text" [(ngModel)]="data.secondaryColor" (ngModelChange)="save()" maxlength="7" />
              </div>
            </label>
          </div>

          <!-- Presets r\xE1pidos -->
          <div class="color-presets">
            <span>Presets:</span>
            @for (preset of colorPresets; track preset.name) {
              <button class="preset-dot"
                [style.background]="'#' + preset.primary"
                [title]="preset.name"
                (click)="applyPreset(preset)">
              </button>
            }
          </div>
        </div>

        <!-- Preview ao vivo -->
        <div class="branding-preview">
          <div class="preview-header"
            [style.background]="'#' + data.primaryColor"
            [style.color]="'white'">
            @if (data.logoUrl) {
              <img [src]="data.logoUrl" class="preview-logo" alt="Logo" />
            }
            <span>{{ data.displayName || 'Minha Empresa AI' }}</span>
          </div>
          <div class="preview-body">
            <div class="preview-bubble bot">Ol\xE1! Como posso ajudar?</div>
            <div class="preview-bubble user"
              [style.background]="'#' + data.primaryColor"
              [style.color]="'white'">
              Como funciona?
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class StepBrandingComponent {
  private onboardingService = inject(OnboardingService);

  data = {
    displayName: '',
    logoUrl: '',
    primaryColor: '2563EB',
    secondaryColor: '7C3AED',
  };

  colorPresets = [
    { name: 'Azul Corporativo', primary: '2563EB', secondary: '7C3AED' },
    { name: 'Verde Moderno',    primary: '059669', secondary: '0891B2' },
    { name: 'Roxo Tech',        primary: '7C3AED', secondary: 'EC4899' },
    { name: 'Laranja Energia',  primary: 'EA580C', secondary: 'CA8A04' },
    { name: 'Teal Sa\xFAde',    primary: '0D9488', secondary: '7C3AED' },
  ];

  applyPreset(preset: { name: string; primary: string; secondary: string }): void {
    this.data.primaryColor = preset.primary;
    this.data.secondaryColor = preset.secondary;
    this.save();
  }

  save(): void {
    this.onboardingService.updateState({ branding: this.data });
  }
}
