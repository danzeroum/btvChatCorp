import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService } from '../services/onboarding.service';
import { PROJECT_TEMPLATES } from '../templates/project-templates';

@Component({
  selector: 'app-step-first-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="step-first-project">
      <div class="step-header">
        <span class="step-emoji">&#127775;</span>
        <h2>Crie seu primeiro projeto de IA</h2>
        <p>Escolha um caso de uso e a IA ser\xE1 configurada automaticamente.</p>
      </div>

      <!-- Templates -->
      <div class="templates-grid">
        @for (tmpl of templates; track tmpl.id) {
          <div class="template-card"
            [class.selected]="data.templateId === tmpl.id"
            (click)="selectTemplate(tmpl.id)">
            <span class="tmpl-icon">{{ tmpl.icon }}</span>
            <h4>{{ tmpl.name }}</h4>
            <p>{{ tmpl.description }}</p>
          </div>
        }
      </div>

      @if (data.templateId) {
        <div class="project-form">
          <div class="form-group">
            <label>Nome do projeto
              <input [(ngModel)]="data.projectName"
                [placeholder]="selectedTemplate?.name || 'Meu projeto'"
                (ngModelChange)="save()" />
            </label>
          </div>
          <div class="form-group">
            <label>Descri\xE7\xE3o
              <textarea [(ngModel)]="data.description"
                rows="3"
                [placeholder]="selectedTemplate?.description || ''"
                (ngModelChange)="save()">
              </textarea>
            </label>
          </div>
          <div class="template-applied">
            <span>&#9989; Template aplicado: instru\xE7\xF5es de sistema pr\xE9-configuradas</span>
          </div>
        </div>
      }
    </div>
  `
})
export class StepFirstProjectComponent {
  private onboardingService = inject(OnboardingService);

  templates = PROJECT_TEMPLATES;
  data = { templateId: '', projectName: '', description: '' };

  get selectedTemplate() {
    return this.templates.find((t) => t.id === this.data.templateId);
  }

  selectTemplate(id: string): void {
    this.data.templateId = id;
    const tmpl = this.templates.find((t) => t.id === id);
    if (tmpl && !this.data.projectName) {
      this.data.projectName = tmpl.name;
      this.data.description = tmpl.description;
    }
    this.save();
  }

  save(): void {
    this.onboardingService.updateState({ project: this.data });
  }
}
