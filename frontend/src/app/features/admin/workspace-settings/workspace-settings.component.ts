import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface WorkspaceSettings {
  name: string;
  timezone: string;
  language: string;
  session_timeout_minutes: number;
  mfa_required: boolean;
  notify_on_new_user: boolean;
  notify_on_training_complete: boolean;
  notify_on_security_event: boolean;
  notification_email: string;
  allow_user_self_registration: boolean;
  auto_training_enabled: boolean;
  data_retention_days: number;
}

const defaultSettings = (): WorkspaceSettings => ({
  name: '',
  timezone: 'America/Sao_Paulo',
  language: 'pt-BR',
  session_timeout_minutes: 480,
  mfa_required: false,
  notify_on_new_user: true,
  notify_on_training_complete: true,
  notify_on_security_event: true,
  notification_email: '',
  allow_user_self_registration: false,
  auto_training_enabled: true,
  data_retention_days: 90,
});

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Configurações do Workspace</h1>
        <p class="subtitle">Gerencie nome, segurança, notificações e políticas de dados.</p>
      </div>

      @if (loading()) {
        <p class="loading-msg">Carregando configurações...</p>
      } @else {
        <!-- Identidade -->
        <div class="section">
          <h2>Identidade</h2>
          <div class="form-group">
            <label>Nome do workspace</label>
            <input type="text" [(ngModel)]="settings.name" placeholder="Minha Empresa" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fuso horário</label>
              <select [(ngModel)]="settings.timezone">
                <option value="America/Sao_Paulo">América / São Paulo (BRT)</option>
                <option value="America/Manaus">América / Manaus (AMT)</option>
                <option value="America/Belem">América / Belém (BRT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div class="form-group">
              <label>Idioma</label>
              <select [(ngModel)]="settings.language">
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Segurança -->
        <div class="section">
          <h2>Segurança & Sessão</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Timeout de sessão (minutos)</label>
              <input type="number" min="15" max="10080" [(ngModel)]="settings.session_timeout_minutes" />
            </div>
          </div>
          <div class="toggle-group">
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.mfa_required" />
              <div class="toggle-text">
                <span>Exigir MFA para todos os usuários</span>
                <span class="toggle-sub">Usuários sem MFA serão bloqueados no próximo login.</span>
              </div>
            </label>
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.allow_user_self_registration" />
              <div class="toggle-text">
                <span>Permitir auto-cadastro</span>
                <span class="toggle-sub">Qualquer pessoa com o link pode criar conta neste workspace.</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Notificações -->
        <div class="section">
          <h2>Notificações</h2>
          <div class="form-group">
            <label>E-mail para notificações</label>
            <input type="email" [(ngModel)]="settings.notification_email" placeholder="admin@empresa.com" />
          </div>
          <div class="toggle-group">
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.notify_on_new_user" />
              <div class="toggle-text">
                <span>Novo usuário</span>
                <span class="toggle-sub">Receba um e-mail quando alguém entrar no workspace.</span>
              </div>
            </label>
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.notify_on_training_complete" />
              <div class="toggle-text">
                <span>Treinamento concluído</span>
                <span class="toggle-sub">Aviso quando um ciclo de treinamento de IA terminar.</span>
              </div>
            </label>
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.notify_on_security_event" />
              <div class="toggle-text">
                <span>Eventos de segurança</span>
                <span class="toggle-sub">Alertas de acesso negado e atividades suspeitas.</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Dados -->
        <div class="section">
          <h2>Dados & IA</h2>
          <div class="form-group">
            <label>Retenção de dados</label>
            <select [(ngModel)]="settings.data_retention_days">
              <option [ngValue]="30">30 dias</option>
              <option [ngValue]="60">60 dias</option>
              <option [ngValue]="90">90 dias</option>
              <option [ngValue]="180">180 dias</option>
              <option [ngValue]="365">1 ano</option>
            </select>
          </div>
          <div class="toggle-group">
            <label class="toggle-label">
              <input type="checkbox" [(ngModel)]="settings.auto_training_enabled" />
              <div class="toggle-text">
                <span>Treinamento automático de IA</span>
                <span class="toggle-sub">Quando ativado, o sistema re-treina automaticamente o modelo de IA toda semana com os feedbacks dos usuários.</span>
              </div>
            </label>
          </div>
        </div>

        @if (saveError()) {
          <p class="error-msg">{{ saveError() }}</p>
        }
        @if (saveSuccess()) {
          <p class="success-msg">Configurações salvas com sucesso.</p>
        }

        <div class="actions">
          <button class="btn-primary" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Salvando...' : 'Salvar configurações' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 720px; }
    .page-header { margin-bottom: 1.5rem; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .subtitle { font-size: 0.85rem; color: #64748b; margin: 0; }
    .loading-msg { color: #64748b; font-size: 0.9rem; }

    .section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    h2 { font-size: 0.9rem; font-weight: 600; color: #0f172a; margin: 0 0 1rem; }

    .form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem; }
    .form-group:last-child { margin-bottom: 0; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    label { font-size: 0.82rem; font-weight: 500; color: #374151; }

    input[type=text], input[type=email], input[type=number], select {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.88rem;
      color: #1e293b;
      width: 100%;
      box-sizing: border-box;
    }
    input:focus, select:focus { border-color: #6366f1; outline: none; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }

    .toggle-group { display: flex; flex-direction: column; gap: 0.75rem; }
    .toggle-label {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
    }
    .toggle-label input[type=checkbox] { margin-top: 3px; flex-shrink: 0; accent-color: #6366f1; }
    .toggle-text { display: flex; flex-direction: column; gap: 2px; }
    .toggle-text span:first-child { font-size: 0.88rem; font-weight: 500; color: #1e293b; }
    .toggle-sub { font-size: 0.78rem; color: #94a3b8; }

    .actions { margin-top: 1.5rem; }
    .btn-primary {
      padding: 0.6rem 1.5rem;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .error-msg { color: #dc2626; font-size: 0.85rem; margin-top: 0.75rem; }
    .success-msg { color: #16a34a; font-size: 0.85rem; margin-top: 0.75rem; }
  `],
})
export class WorkspaceSettingsComponent implements OnInit {
  private http = inject(HttpClient);

  settings = defaultSettings();
  loading = signal(true);
  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  ngOnInit(): void {
    this.http.get<WorkspaceSettings>('/api/v1/admin/settings').subscribe({
      next: (data) => {
        this.settings = { ...defaultSettings(), ...data };
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);
    this.http.put('/api/v1/admin/settings', this.settings).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.error?.message || 'Erro ao salvar configurações.');
      },
    });
  }
}
