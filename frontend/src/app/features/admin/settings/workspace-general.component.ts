import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  // Segurança de sessão
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  mfaRequired: boolean;
  allowedLoginMethods: ('email' | 'sso_google' | 'sso_microsoft' | 'sso_saml')[];
  ipWhitelist: string[];
  // Notificações
  notifyOnNewUser: boolean;
  notifyOnTrainingComplete: boolean;
  notifyOnSecurityEvent: boolean;
  notificationEmail: string;
  // Misc
  defaultUserRole: string;
  allowUserSelfRegistration: boolean;
  updatedAt: string;
}

@Component({
  selector: 'app-workspace-general',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="workspace-general">
      <div class="page-header">
        <div>
          <h1>&#9881;&#65039; Configurações Gerais</h1>
          <p>Informações e políticas globais do workspace.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="load()">Descartar alterações</button>
          <button class="btn-primary" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Salvando...' : 'Salvar alterações' }}
          </button>
        </div>
      </div>

      @if (saved()) {
        <div class="toast success">✅ Configurações salvas com sucesso!</div>
      }

      <div class="settings-sections">

        <!-- Identidade -->
        <section class="settings-section">
          <h2>&#127970; Identidade do Workspace</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>Nome do workspace *
                <input [(ngModel)]="form.name" placeholder="Minha Empresa" />
              </label>
            </div>
            <div class="form-group">
              <label>Slug (URL)
                <div class="slug-input">
                  <span class="slug-prefix">app.btvchat.com/</span>
                  <input [(ngModel)]="form.slug" placeholder="minha-empresa" />
                </div>
              </label>
            </div>
            <div class="form-group">
              <label>Fuso horário
                <select [(ngModel)]="form.timezone">
                  @for (tz of timezones; track tz.value) {
                    <option [value]="tz.value">{{ tz.label }}</option>
                  }
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>Idioma padrão
                <select [(ngModel)]="form.language">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <!-- Segurança de sessão -->
        <section class="settings-section">
          <h2>&#128274; Segurança e Acesso</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>Timeout de sessão (minutos)
                <input type="number" [(ngModel)]="form.sessionTimeoutMinutes" min="5" max="10080" />
                <span class="hint">5 min – 7 dias (10080 min)</span>
              </label>
            </div>
            <div class="form-group">
              <label>Máx. sessões simultâneas por usuário
                <input type="number" [(ngModel)]="form.maxConcurrentSessions" min="1" max="20" />
              </label>
            </div>
          </div>

          <div class="toggle-group">
            <label class="toggle-label">
              <div class="toggle-info">
                <span>MFA obrigatório para todos os usuários</span>
                <span class="hint">Usuários sem MFA serão redirecionados na próxima sessão</span>
              </div>
              <div class="toggle-switch" [class.on]="form.mfaRequired" (click)="form.mfaRequired = !form.mfaRequired">
                <div class="toggle-knob"></div>
              </div>
            </label>

            <label class="toggle-label">
              <div class="toggle-info">
                <span>Permitir auto-registro de usuários</span>
                <span class="hint">Qualquer pessoa com e-mail do domínio pode criar conta</span>
              </div>
              <div class="toggle-switch" [class.on]="form.allowUserSelfRegistration" (click)="form.allowUserSelfRegistration = !form.allowUserSelfRegistration">
                <div class="toggle-knob"></div>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>Métodos de login permitidos
              <div class="method-checkboxes">
                @for (method of loginMethods; track method.value) {
                  <label class="checkbox-label">
                    <input type="checkbox"
                      [checked]="form.allowedLoginMethods?.includes(method.value)"
                      (change)="toggleLoginMethod(method.value, $event)" />
                    {{ method.label }}
                  </label>
                }
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>IP Whitelist (um por linha, vazio = todos permitidos)
              <textarea [(ngModel)]="ipWhitelistText" rows="4"
                placeholder="192.168.1.0/24&#10;10.0.0.1"
                (blur)="parseIpWhitelist()">
              </textarea>
            </label>
          </div>
        </section>

        <!-- Notificações -->
        <section class="settings-section">
          <h2>&#128276; Notificações do Admin</h2>
          <div class="form-group">
            <label>E-mail para notificações administrativas
              <input type="email" [(ngModel)]="form.notificationEmail" placeholder="admin@empresa.com" />
            </label>
          </div>
          <div class="toggle-group">
            <label class="toggle-label">
              <span>Novo usuário convidado ou registrado</span>
              <div class="toggle-switch" [class.on]="form.notifyOnNewUser" (click)="form.notifyOnNewUser = !form.notifyOnNewUser">
                <div class="toggle-knob"></div>
              </div>
            </label>
            <label class="toggle-label">
              <span>Ciclo de treinamento concluído</span>
              <div class="toggle-switch" [class.on]="form.notifyOnTrainingComplete" (click)="form.notifyOnTrainingComplete = !form.notifyOnTrainingComplete">
                <div class="toggle-knob"></div>
              </div>
            </label>
            <label class="toggle-label">
              <span>Evento de segurança crítico</span>
              <div class="toggle-switch" [class.on]="form.notifyOnSecurityEvent" (click)="form.notifyOnSecurityEvent = !form.notifyOnSecurityEvent">
                <div class="toggle-knob"></div>
              </div>
            </label>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="settings-section danger-zone">
          <h2>&#9888;&#65039; Zona de Perigo</h2>
          <div class="danger-actions">
            <div class="danger-item">
              <div>
                <h4>Exportar todos os dados</h4>
                <p>Gera um arquivo ZIP com todos os chats, documentos e configurações.</p>
              </div>
              <button class="btn-secondary" (click)="exportAll()">&#11015;&#65039; Exportar tudo</button>
            </div>
            <div class="danger-item">
              <div>
                <h4>Excluir workspace</h4>
                <p>Remove permanentemente o workspace e todos os seus dados. Irreversível.</p>
              </div>
              <button class="btn-danger" (click)="confirmDelete()">&#128465;&#65039; Excluir workspace</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `
})
export class WorkspaceGeneralComponent implements OnInit {
  private http = inject(HttpClient);

  saving = signal(false);
  saved  = signal(false);
  form: WorkspaceSettings = {} as WorkspaceSettings;
  ipWhitelistText = '';

  timezones = [
    { value: 'America/Sao_Paulo',  label: 'América/São Paulo (BRT -3)' },
    { value: 'America/New_York',   label: 'América/New York (EST -5)' },
    { value: 'Europe/Lisbon',      label: 'Europa/Lisboa (WET 0)' },
    { value: 'UTC',                label: 'UTC' },
  ];

  loginMethods = [
    { value: 'email',         label: '📧 E-mail + senha' },
    { value: 'sso_google',    label: '🔵 Google SSO' },
    { value: 'sso_microsoft', label: '🪟 Microsoft SSO' },
    { value: 'sso_saml',      label: '🏢 SAML 2.0' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<WorkspaceSettings>('/api/admin/settings').subscribe((s) => {
      this.form = { ...s };
      this.ipWhitelistText = (s.ipWhitelist || []).join('\n');
    });
  }

  save(): void {
    this.saving.set(true);
    this.parseIpWhitelist();
    this.http.put('/api/admin/settings', this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => this.saving.set(false),
    });
  }

  toggleLoginMethod(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const methods = this.form.allowedLoginMethods || [];
    this.form.allowedLoginMethods = checked ? [...methods, value as any] : methods.filter((m) => m !== value);
  }

  parseIpWhitelist(): void {
    this.form.ipWhitelist = this.ipWhitelistText.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  exportAll(): void { window.open('/api/admin/export/all', '_blank'); }

  confirmDelete(): void {
    const name = prompt('Digite o nome do workspace para confirmar a exclusão:');
    if (name === this.form.name) {
      this.http.delete('/api/admin/workspace').subscribe(() => { window.location.href = '/logout'; });
    }
  }
}
