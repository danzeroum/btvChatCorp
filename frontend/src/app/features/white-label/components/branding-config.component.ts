import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandingService } from '../services/branding.service';
import { WorkspaceBranding, BrandTheme, DEFAULT_THEME } from '../models/branding.model';

@Component({
  selector: 'app-branding-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="branding-config">
      <div class="page-header">
        <h1>&#127912; Identidade Visual</h1>
        <p>Personalize a plataforma com a identidade da sua empresa.</p>
      </div>

      <div class="branding-layout">
        <!-- Formulário -->
        <div class="branding-form">

          <!-- Seção: Identidade -->
          <section class="config-section">
            <h3>Identidade</h3>
            <div class="form-group">
              <label>Nome da empresa
                <input [(ngModel)]="draft.companyName" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
            <div class="form-group">
              <label>Nome exibido na plataforma
                <input [(ngModel)]="draft.platformName" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
            <div class="form-group">
              <label>Tagline (opcional)
                <input [(ngModel)]="draft.tagline" placeholder="Inteligência para decisões" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
          </section>

          <!-- Seção: Logos -->
          <section class="config-section">
            <h3>Logos</h3>
            <div class="form-group">
              <label>Logo principal (URL)
                <input [(ngModel)]="draft.logoUrl" placeholder="https://cdn.empresa.com/logo.svg" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
            <div class="form-group">
              <label>Logo escuro (fundo escuro)
                <input [(ngModel)]="draft.logoDarkUrl" placeholder="https://..." (ngModelChange)="onLiveChange()" />
              </label>
            </div>
            <div class="form-group">
              <label>Favicon (URL 32x32)
                <input [(ngModel)]="draft.faviconUrl" placeholder="https://..." (ngModelChange)="onLiveChange()" />
              </label>
            </div>
          </section>

          <!-- Seção: Cores -->
          <section class="config-section">
            <h3>Cores</h3>
            <div class="color-grid">
              @for (field of colorFields; track field.key) {
                <div class="form-group">
                  <label>{{ field.label }}
                    <div class="color-row">
                      <input type="color"
                        [value]="'#' + getThemeVal(field.key)"
                        (input)="setThemeVal(field.key, $any($event.target).value.replace('#',''))" />
                      <input type="text"
                        [ngModel]="getThemeVal(field.key)"
                        (ngModelChange)="setThemeVal(field.key, $event)"
                        maxlength="6" />
                    </div>
                  </label>
                </div>
              }
            </div>
          </section>

          <!-- Seção: Tipografia -->
          <section class="config-section">
            <h3>Tipografia</h3>
            <div class="form-group">
              <label>Família de fonte
                <select [(ngModel)]="draft.theme.fontFamily" (ngModelChange)="onLiveChange()">
                  @for (f of fontOptions; track f.value) {
                    <option [value]="f.value">{{ f.label }}</option>
                  }
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>Border radius
                <input [(ngModel)]="draft.theme.borderRadius" (ngModelChange)="onLiveChange()" placeholder="8px" />
              </label>
            </div>
          </section>

          <!-- Seção: Domínio -->
          <section class="config-section">
            <h3>Domínio Customizado</h3>
            <div class="form-group">
              <label>Subdomínio atual
                <div class="subdomain-display">{{ draft.subdomain }}.aiplatform.com</div>
              </label>
            </div>
            <div class="form-group">
              <label>Domínio próprio (opcional)
                <input [(ngModel)]="draft.customDomain" placeholder="ai.empresa.com.br" />
              </label>
            </div>
            @if (draft.customDomainStatus) {
              <div class="domain-status" [class]="draft.customDomainStatus">
                @switch (draft.customDomainStatus) {
                  @case ('pending_dns') { &#9203; Aguardando propagação DNS }
                  @case ('pending_ssl') { &#128274; Provisionando SSL... }
                  @case ('active')      { &#9989; Domínio ativo }
                  @case ('error')       { &#10060; Erro na configuração }
                }
              </div>
            }
          </section>

          <!-- Seção: Chat -->
          <section class="config-section">
            <h3>Chat</h3>
            <div class="form-group">
              <label>Nome do bot
                <input [(ngModel)]="draft.chatBotName" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
            <div class="form-group">
              <label>Mensagem de boas-vindas
                <textarea [(ngModel)]="draft.chatWelcomeMessage" rows="2" (ngModelChange)="onLiveChange()"></textarea>
              </label>
            </div>
            <div class="form-group">
              <label>Placeholder do input
                <input [(ngModel)]="draft.chatPlaceholder" (ngModelChange)="onLiveChange()" />
              </label>
            </div>
          </section>

          <!-- Seção: Feature Flags -->
          <section class="config-section">
            <h3>Funcionalidades visíveis</h3>
            <div class="flags-list">
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="draft.featureFlags.showPoweredBy" />
                Exibir "Powered by AI Platform"
              </label>
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="draft.featureFlags.showDocumentation" />
                Link para documentação
              </label>
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="draft.featureFlags.showChangelog" />
                Novidades / Changelog
              </label>
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="draft.featureFlags.showSupportChat" />
                Chat de suporte
              </label>
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="draft.featureFlags.allowUserRegistration" />
                Permitir auto-registro de usuários
              </label>
            </div>
          </section>

          <!-- Seção: CSS Avançado -->
          <section class="config-section">
            <h3>CSS Customizado (avançado)</h3>
            <textarea [(ngModel)]="draft.theme.customCss"
              rows="6"
              class="code-editor"
              placeholder="/* Adicione overrides CSS aqui */\n.my-selector { color: red; }"
              (ngModelChange)="onLiveChange()">
            </textarea>
          </section>

          <!-- Ações -->
          <div class="form-actions">
            <button class="btn-secondary" (click)="resetToDefault()">Restaurar padrão</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : '&#128190; Salvar alterações' }}
            </button>
          </div>
        </div>

        <!-- Preview ao vivo -->
        <app-theme-preview [branding]="draft"></app-theme-preview>
      </div>
    </div>
  `
})
export class BrandingConfigComponent implements OnInit {
  private brandingService = inject(BrandingService);

  saving = signal(false);
  draft!: WorkspaceBranding;

  colorFields = [
    { key: 'primary',        label: 'Cor primária' },
    { key: 'secondary',      label: 'Cor secundária' },
    { key: 'sidebarBg',      label: 'Fundo sidebar' },
    { key: 'sidebarText',    label: 'Texto sidebar' },
    { key: 'background',     label: 'Fundo principal' },
    { key: 'surface',        label: 'Cards / Modais' },
    { key: 'textPrimary',    label: 'Texto principal' },
    { key: 'textSecondary',  label: 'Texto secundário' },
    { key: 'border',         label: 'Bordas' },
    { key: 'success',        label: 'Sucesso' },
    { key: 'warning',        label: 'Aviso' },
    { key: 'error',          label: 'Erro' },
  ] as const;

  fontOptions = [
    { label: 'Inter (padrão)',        value: 'Inter, system-ui, sans-serif' },
    { label: 'Roboto',                value: 'Roboto, sans-serif' },
    { label: 'DM Sans',               value: 'DM Sans, sans-serif' },
    { label: 'Plus Jakarta Sans',     value: 'Plus Jakarta Sans, sans-serif' },
    { label: 'IBM Plex Sans',         value: 'IBM Plex Sans, sans-serif' },
  ];

  ngOnInit(): void {
    const current = this.brandingService.branding();
    if (current) {
      this.draft = structuredClone(current);
    } else {
      // Fallback com defaults
      this.draft = {
        id: '', workspaceId: '', companyName: '', platformName: 'Minha Empresa AI',
        subdomain: '', emailFromName: '', chatWelcomeMessage: 'Olá! Como posso ajudar?',
        chatPlaceholder: 'Digite sua pergunta...', chatBotName: 'Assistente',
        theme: { ...DEFAULT_THEME },
        featureFlags: { showPoweredBy: true, showDocumentation: true, showChangelog: true, showSupportChat: false, allowUserRegistration: false },
        createdAt: '', updatedAt: '',
      };
    }
  }

  getThemeVal(key: string): string {
    return (this.draft.theme as any)[key] ?? '';
  }

  setThemeVal(key: string, value: string): void {
    (this.draft.theme as any)[key] = value.replace('#', '');
    this.onLiveChange();
  }

  onLiveChange(): void {
    this.brandingService.previewTheme(this.draft.theme);
  }

  save(): void {
    this.saving.set(true);
    this.brandingService.save(this.draft.workspaceId, this.draft).subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false),
    });
  }

  resetToDefault(): void {
    this.draft.theme = { ...DEFAULT_THEME };
    this.onLiveChange();
  }
}
