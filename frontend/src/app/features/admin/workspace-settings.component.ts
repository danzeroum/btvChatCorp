import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface WorkspaceSettings {
  name: string;
  subdomain: string;
  autoAnonymize: boolean;
  sensitiveKeywords: string[];
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopK: number;
  trainingEnabled: boolean;
  apiAccessEnabled: boolean;
}

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-panel">
      <h2>Configurações do Workspace</h2>
      @if (settings) {
        <form (submit)="save()">
          <div class="field">
            <label>Nome do workspace</label>
            <input [(ngModel)]="settings.name" name="name">
          </div>
          <div class="field">
            <label>Subdomínio</label>
            <input [(ngModel)]="settings.subdomain" name="subdomain" [disabled]="true">
          </div>
          <div class="field toggle">
            <label>Anonimização automática de PII</label>
            <input type="checkbox" [(ngModel)]="settings.autoAnonymize" name="autoAnonymize">
          </div>
          <div class="field toggle">
            <label>Habilitar treinamento contínuo</label>
            <input type="checkbox" [(ngModel)]="settings.trainingEnabled" name="trainingEnabled">
          </div>
          <div class="field toggle">
            <label>Habilitar acesso à API pública</label>
            <input type="checkbox" [(ngModel)]="settings.apiAccessEnabled" name="apiAccessEnabled">
          </div>
          <div class="field">
            <label>Temperatura padrão do modelo ({{ settings.defaultTemperature }})</label>
            <input type="range" min="0" max="1" step="0.05"
                   [(ngModel)]="settings.defaultTemperature" name="temperature">
          </div>
          <button type="submit" class="save-btn">💾 Salvar configurações</button>
        </form>
      }
    </div>
  `
})
export class WorkspaceSettingsComponent implements OnInit {
  private http = inject(HttpClient);
  settings: WorkspaceSettings | null = null;

  ngOnInit(): void {
    this.http.get<WorkspaceSettings>('/api/admin/workspace/settings').subscribe(s => this.settings = s);
  }

  save(): void {
    this.http.put('/api/admin/workspace/settings', this.settings).subscribe();
  }
}
