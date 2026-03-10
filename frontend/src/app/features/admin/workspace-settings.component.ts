import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService, WorkspaceContext } from '../../core/services/workspace-context.service';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="workspace-settings">
      <h2>&#9881;&#65039; Configurações do Workspace</h2>

      @if (loading()) {
        <div class="loading">Carregando...</div>
      } @else if (form()) {
        <form (ngSubmit)="save()" #f="ngForm">

          <!-- Informações gerais -->
          <section class="settings-section">
            <h3>&#127970; Informações Gerais</h3>
            <label>Nome do workspace
              <input [(ngModel)]="form()!.workspaceName" name="workspaceName" required />
            </label>
            <label>Setor
              <select [(ngModel)]="form()!.sector" name="sector">
                <option value="generic">Genérico</option>
                <option value="legal">Jurídico</option>
                <option value="health">Saúde</option>
                <option value="hr">RH</option>
                <option value="finance">Financeiro</option>
              </select>
            </label>
            <label>Retenção de dados (dias)
              <input type="number" [(ngModel)]="form()!.dataRetentionDays" name="dataRetentionDays" min="30" max="3650" />
            </label>
          </section>

          <!-- Privacidade & Compliance -->
          <section class="settings-section">
            <h3>&#128274; Privacidade &amp; Compliance</h3>
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="form()!.autoAnonymize" name="autoAnonymize" />
              Anonimizar PII automaticamente antes de enviar ao modelo
            </label>
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="form()!.allowTraining" name="allowTraining" />
              Permitir uso de interações para treinamento do modelo
            </label>
            <label>Palavras-chave sensíveis (uma por linha)
              <textarea
                [ngModel]="form()!.sensitiveKeywords.join('\n')"
                (ngModelChange)="onKeywordsChange($event)"
                name="sensitiveKeywords"
                rows="5"
                placeholder="contrato\nconfidencial\nsalario">
              </textarea>
            </label>
          </section>

          <!-- Branding (White-label) -->
          <section class="settings-section">
            <h3>&#127912; Branding (White-label)</h3>
            <label>Nome exibido
              <input [(ngModel)]="form()!.branding.displayName" name="displayName" />
            </label>
            <label>Cor primária
              <div class="color-row">
                <input type="color" [(ngModel)]="form()!.branding.primaryColor" name="primaryColor" />
                <input type="text" [(ngModel)]="form()!.branding.primaryColor" name="primaryColorHex" />
              </div>
            </label>
            <label>Cor secundária
              <div class="color-row">
                <input type="color" [(ngModel)]="form()!.branding.secondaryColor" name="secondaryColor" />
                <input type="text" [(ngModel)]="form()!.branding.secondaryColor" name="secondaryColorHex" />
              </div>
            </label>
            <label>URL do logo
              <input [(ngModel)]="form()!.branding.logoUrl" name="logoUrl" placeholder="https://..." />
            </label>
            <label>URL do favicon
              <input [(ngModel)]="form()!.branding.faviconUrl" name="faviconUrl" placeholder="https://..." />
            </label>
          </section>

          <div class="form-actions">
            <button type="submit" class="btn-save" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : '&#128190; Salvar alterações' }}
            </button>
            @if (saved()) {
              <span class="success-msg">&#9989; Salvo com sucesso!</span>
            }
          </div>
        </form>
      }
    </div>
  `
})
export class WorkspaceSettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  form = signal<WorkspaceContext | null>(null);

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http.get<WorkspaceContext>(`/api/workspaces/${wsId}/context`)
      .subscribe({
        next: (ctx) => { this.form.set({ ...ctx }); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  onKeywordsChange(value: string): void {
    this.form.update((f) => f ? {
      ...f,
      sensitiveKeywords: value.split('\n').map((k) => k.trim()).filter(Boolean)
    } : f);
  }

  save(): void {
    const f = this.form();
    if (!f) return;
    this.saving.set(true);
    this.saved.set(false);
    this.http.put(`/api/workspaces/${f.workspaceId}`, f)
      .subscribe({
        next: () => {
          this.workspaceCtx.setContext(f);
          this.saving.set(false);
          this.saved.set(true);
          setTimeout(() => this.saved.set(false), 3000);
        },
        error: () => this.saving.set(false),
      });
  }
}
