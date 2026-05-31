import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <h1>Configurações do Workspace</h1>
      <div class="section">
        <h2>Retenção de dados</h2>
        <select [(ngModel)]="retention">
          <option value="30">30 dias</option>
          <option value="60">60 dias</option>
          <option value="90">90 dias</option>
          <option value="180">180 dias</option>
        </select>
      </div>
      <div class="section">
        <h2>Treinamento automático</h2>
        <label>
          <input type="checkbox" [(ngModel)]="autoTraining" />
          Ativar ciclo semanal de LoRA
        </label>
      </div>
      @if (saveError()) {
        <p class="error">{{ saveError() }}</p>
      }
      @if (saveSuccess()) {
        <p class="success">Configurações salvas com sucesso.</p>
      }
      <button (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Salvando...' : 'Salvar configurações' }}
      </button>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; }
    h1 { margin-bottom: 1.5rem; }
    .section { background: #1e1e1e; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    h2 { font-size: 1rem; margin-bottom: 1rem; color: #ccc; }
    select, input[type=checkbox] { margin-top: 0.25rem; }
    select { padding: 0.5rem; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 6px; }
    button { margin-top: 1rem; padding: 0.75rem 2rem; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { color: #f87171; margin-top: 0.5rem; }
    .success { color: #4ade80; margin-top: 0.5rem; }
  `]
})
export class WorkspaceSettingsComponent {
  private http = inject(HttpClient);

  retention = '90';
  autoTraining = true;
  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  save(): void {
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);
    this.http.patch('/api/v1/admin/settings', {
      data_retention_days: parseInt(this.retention, 10),
      auto_training_enabled: this.autoTraining,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.error?.message || 'Erro ao salvar configurações.');
      },
    });
  }
}
