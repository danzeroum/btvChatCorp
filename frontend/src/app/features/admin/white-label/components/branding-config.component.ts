import { Component, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminBrandingConfig } from '../../admin.service';
import { BrandTheme, FeatureFlags, DEFAULT_THEME } from '../../../white-label/models/branding.model';

type ThemeColorKey = 'primary' | 'secondary' | 'background' | 'surface' | 'textPrimary' | 'border';

const FONT_PRESETS = [
  { label: 'Inter (padrão)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'DM Sans', value: 'DM Sans, sans-serif' },
];

@Component({
  selector: 'app-branding-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="branding-config">
      <div class="page-header">
        <div>
          <h1>&#127912; White-Label & Branding</h1>
          <p>Personalize a aparência da plataforma para seus clientes.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="previewMode.set(!previewMode())">{{ previewMode() ? '✕ Fechar preview' : '👁️ Preview ao vivo' }}</button>
          <button class="btn-primary" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Salvando...' : 'Publicar' }}
          </button>
        </div>
      </div>

      @if (saved()) {
        <div class="toast success">✅ Branding publicado!</div>
      }

      <div class="branding-layout" [class.preview-open]="previewMode()">

        <!-- Formulário -->
        <div class="branding-form">

          <!-- Identidade -->
          <section class="settings-section">
            <h2>&#127970; Identidade</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Nome da plataforma
                  <input [(ngModel)]="form.platformName" placeholder="Minha Plataforma AI" />
                </label>
              </div>
              <div class="form-group">
                <label>Nome da empresa
                  <input [(ngModel)]="form.companyName" placeholder="Acme Corp" />
                </label>
              </div>
              <div class="form-group">
                <label>Tagline
                  <input [(ngModel)]="form.tagline" placeholder="Inteligência artificial para sua empresa" />
                </label>
              </div>
              <div class="form-group">
                <label>Subdomínio
                  <input [(ngModel)]="form.subdomain" placeholder="acme" />
                </label>
              </div>
            </div>

            <div class="upload-row">
              <div class="upload-group">
                <label>Logo principal (PNG/SVG, 200×60px)</label>
                <div class="upload-area" (click)="uploadLogo()">
                  @if (form.logoUrl) {
                    <img [src]="form.logoUrl" alt="Logo" class="logo-preview" />
                  } @else {
                    <span>&#128444;&#65039; Clique para fazer upload</span>
                  }
                </div>
                <input #logoInput type="file" accept="image/*" class="hidden" (change)="onLogoChange($event)" />
              </div>
              <div class="upload-group">
                <label>Favicon (32×32px)</label>
                <div class="upload-area favicon-area" (click)="uploadFavicon()">
                  @if (form.faviconUrl) {
                    <img [src]="form.faviconUrl" alt="Favicon" class="favicon-preview" />
                  } @else {
                    <span>&#128444;&#65039;</span>
                  }
                </div>
                <input #faviconInput type="file" accept="image/*" class="hidden" (change)="onFaviconChange($event)" />
              </div>
            </div>
          </section>

          <!-- Cores -->
          <section class="settings-section">
            <h2>&#127912; Paleta de Cores</h2>
            <div class="color-grid">
              @for (col of colorFields; track col.key) {
                <div class="color-field">
                  <label>{{ col.label }}</label>
                  <div class="color-input-row">
                    <input type="color" [ngModel]="form.theme[col.key]" (ngModelChange)="form.theme[col.key] = $event" />
                    <input type="text" [ngModel]="form.theme[col.key]" (ngModelChange)="form.theme[col.key] = $event" placeholder="#6366f1" maxlength="7" />
                  </div>
                </div>
              }
            </div>
            <div class="color-presets">
              <span>Presets:</span>
              @for (preset of colorPresets; track preset.name) {
                <button class="preset-btn" (click)="applyPreset(preset)" [title]="preset.name">
                  <span class="preset-dot" [style.background]="preset.primary"></span>
                  {{ preset.name }}
                </button>
              }
            </div>
          </section>

          <!-- Tipografia -->
          <section class="settings-section">
            <h2>&#128295; Tipografia</h2>
            <div class="form-group">
              <label>Família tipográfica
                <select [ngModel]="selectedFont()" (ngModelChange)="onFontChange($event)">
                  @for (f of fontPresets; track f.value) {
                    <option [value]="f.value">{{ f.label }}</option>
                  }
                  <option value="__custom__">Personalizada (URL)</option>
                </select>
              </label>
            </div>
            @if (selectedFont() === '__custom__') {
              <div class="form-group" style="margin-top:12px">
                <label>Fonte personalizada (CSS font-family ou URL Google Fonts)
                  <input [(ngModel)]="form.theme.fontFamily" placeholder="'MyFont', sans-serif" />
                </label>
              </div>
            }
          </section>

          <!-- Chat -->
          <section class="settings-section">
            <h2>&#128172; Personalização do Chat</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Nome do assistente
                  <input [(ngModel)]="form.chatBotName" placeholder="Assistente" />
                </label>
              </div>
              <div class="form-group">
                <label>Mensagem de boas-vindas
                  <input [(ngModel)]="form.chatWelcomeMessage" placeholder="Olá! Como posso ajudar?" />
                </label>
              </div>
              <div class="form-group">
                <label>Placeholder do campo de mensagem
                  <input [(ngModel)]="form.chatPlaceholder" placeholder="Digite sua mensagem..." />
                </label>
              </div>
            </div>
          </section>

          <!-- Email -->
          <section class="settings-section">
            <h2>&#128231; Email Transacional</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Nome do remetente
                  <input [(ngModel)]="form.emailFromName" placeholder="Suporte Acme" />
                </label>
              </div>
              <div class="form-group">
                <label>Email do remetente
                  <input type="email" [(ngModel)]="form.emailFromAddress" placeholder="no-reply@acme.com" />
                </label>
              </div>
            </div>
          </section>

          <!-- Domínio -->
          <section class="settings-section">
            <h2>&#127760; Domínio Personalizado</h2>
            <div class="form-group">
              <label>Domínio (ex: chat.suaempresa.com)
                <div class="domain-input">
                  <input [(ngModel)]="form.customDomain" placeholder="chat.suaempresa.com" />
                  <button class="btn-secondary" (click)="verifyDomain()" [disabled]="verifying()">
                    {{ verifying() ? '⏳ Verificando...' : '🔍 Verificar DNS' }}
                  </button>
                </div>
              </label>
            </div>
            @if (form.customDomainStatus) {
              <div class="domain-status" [class]="form.customDomainStatus">
                {{ form.customDomainStatus === 'verified' ? '✅ Domínio verificado e ativo' :
                   form.customDomainStatus === 'pending'  ? '⏳ Aguardando propagação DNS' :
                   '❌ Falha na verificação DNS' }}
              </div>
              @if (form.customDomainStatus === 'pending') {
                <div class="dns-instructions">
                  <p>Adicione o seguinte registro CNAME no seu provedor de DNS:</p>
                  <code>{{ form.customDomain }} CNAME cname.btvchat.com</code>
                </div>
              }
            }
          </section>

          <!-- Página de Login -->
          <section class="settings-section">
            <h2>&#128274; Página de Login</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Título da página
                  <input [(ngModel)]="form.loginPageTitle" placeholder="Bem-vindo de volta!" />
                </label>
              </div>
              <div class="form-group">
                <label>Subtítulo
                  <input [(ngModel)]="form.loginPageSubtitle" placeholder="Acesse seu workspace" />
                </label>
              </div>
              <div class="form-group">
                <label>URL da imagem de fundo
                  <input type="url" [(ngModel)]="form.loginBackgroundUrl" placeholder="https://..." />
                </label>
              </div>
            </div>
          </section>

          <!-- Legais e suporte -->
          <section class="settings-section">
            <h2>&#128196; Links Legais e Suporte</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>URL dos Termos de Uso
                  <input type="url" [(ngModel)]="form.termsUrl" placeholder="https://..." />
                </label>
              </div>
              <div class="form-group">
                <label>URL da Política de Privacidade
                  <input type="url" [(ngModel)]="form.privacyUrl" placeholder="https://..." />
                </label>
              </div>
              <div class="form-group">
                <label>E-mail de suporte
                  <input type="email" [(ngModel)]="form.supportEmail" placeholder="suporte@empresa.com" />
                </label>
              </div>
              <div class="form-group">
                <label>URL de suporte
                  <input type="url" [(ngModel)]="form.supportUrl" placeholder="https://suporte.empresa.com" />
                </label>
              </div>
            </div>
          </section>

          <!-- Features visíveis -->
          <section class="settings-section">
            <h2>&#128270; Funcionalidades Visíveis</h2>
            <p class="hint" style="margin-bottom:12px">Controle quais seções e funcionalidades ficam disponíveis no workspace.</p>
            <div class="toggle-group">
              @for (feat of featureToggles; track feat.key) {
                <label class="toggle-label">
                  <div>
                    <span>{{ feat.label }}</span>
                    @if (feat.hint) { <span class="hint">{{ feat.hint }}</span> }
                  </div>
                  <div class="toggle-switch" [class.on]="form.featureFlags[feat.key]" (click)="toggleFeature(feat.key)">
                    <div class="toggle-knob"></div>
                  </div>
                </label>
              }
            </div>
          </section>
        </div>

        <!-- Preview ao vivo -->
        @if (previewMode()) {
          <div class="branding-preview" [style]="previewCssVars()">
            <div class="preview-header">
              @if (form.logoUrl) {
                <img [src]="form.logoUrl" alt="Logo" class="preview-logo" />
              } @else {
                <span class="preview-product-name">{{ form.platformName || 'Sua Plataforma' }}</span>
              }
            </div>
            <div class="preview-body">
              <div class="preview-sidebar">
                <div class="preview-nav-item active">&#128172; Conversas</div>
                <div class="preview-nav-item">&#128218; Projetos</div>
                <div class="preview-nav-item">&#128101; Administração</div>
              </div>
              <div class="preview-content">
                <div class="preview-chat">
                  <div class="preview-msg user">Qual é o prazo de entrega?</div>
                  <div class="preview-msg ai">De acordo com o contrato vigente, o prazo é de 30 dias úteis.</div>
                </div>
              </div>
            </div>
            <div class="preview-footer">
              @if (form.featureFlags.showPoweredBy) {
                <span>Powered by BTV Chat</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: Inter, system-ui, sans-serif; }
    .branding-config { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .page-header p { font-size: 13px; color: #64748b; margin: 0; }
    .header-actions { display: flex; gap: 10px; }

    .btn-primary { padding: 8px 18px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 18px; cursor: pointer; font-size: 13px; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

    .toast { padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
    .toast.success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }

    .branding-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .branding-layout.preview-open { grid-template-columns: 1fr 380px; align-items: start; }

    .settings-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
    .settings-section h2 { font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 16px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: 12px; font-weight: 500; color: #374151; display: flex; flex-direction: column; gap: 4px; }
    .form-group input, .form-group select { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #1e293b; width: 100%; box-sizing: border-box; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

    .upload-row { display: flex; gap: 20px; margin-top: 16px; }
    .upload-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .upload-group > label { font-size: 12px; font-weight: 500; color: #374151; }
    .upload-area { border: 2px dashed #cbd5e1; border-radius: 10px; min-height: 80px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; color: #94a3b8; transition: border-color 0.15s; padding: 12px; text-align: center; }
    .upload-area:hover { border-color: #6366f1; color: #6366f1; }
    .favicon-area { min-height: 60px; max-width: 80px; }
    .logo-preview { max-height: 56px; max-width: 100%; object-fit: contain; }
    .favicon-preview { width: 32px; height: 32px; object-fit: contain; }
    .hidden { display: none; }

    .color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
    .color-field { display: flex; flex-direction: column; gap: 4px; }
    .color-field > label { font-size: 12px; font-weight: 500; color: #374151; }
    .color-input-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .color-input-row input[type="color"] { width: 36px; height: 32px; padding: 2px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; flex-shrink: 0; }
    .color-input-row input[type="text"] { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-family: monospace; color: #1e293b; }
    .color-input-row input[type="text"]:focus { outline: none; border-color: #6366f1; }

    .color-presets { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .color-presets > span { font-size: 12px; color: #94a3b8; font-weight: 500; }
    .preset-btn { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid #e2e8f0; border-radius: 20px; background: #f8fafc; font-size: 12px; color: #374151; cursor: pointer; }
    .preset-btn:hover { border-color: #6366f1; color: #6366f1; }
    .preset-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }

    .domain-input { display: flex; gap: 8px; margin-top: 4px; }
    .domain-input input { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #1e293b; }
    .domain-input input:focus { outline: none; border-color: #6366f1; }
    .domain-status { padding: 8px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; }
    .domain-status.verified { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .domain-status.pending { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .domain-status.failed { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .dns-instructions { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-top: 10px; font-size: 12px; color: #374151; }
    .dns-instructions p { margin: 0 0 8px; }
    .dns-instructions code { display: block; background: #1e293b; color: #e2e8f0; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; }

    .hint { font-size: 11px; color: #94a3b8; }
    .toggle-group { display: flex; flex-direction: column; gap: 12px; }
    .toggle-label { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 4px 0; }
    .toggle-label > div { display: flex; flex-direction: column; gap: 2px; }
    .toggle-label > div span:first-child, .toggle-label > span { font-size: 13px; color: #0f172a; }
    .toggle-switch { width: 40px; height: 22px; border-radius: 11px; background: #e2e8f0; position: relative; flex-shrink: 0; transition: background 0.2s; }
    .toggle-switch.on { background: #6366f1; }
    .toggle-knob { width: 16px; height: 16px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: left 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .toggle-switch.on .toggle-knob { left: 21px; }

    .branding-preview { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: var(--bg, #0f172a); position: sticky; top: 80px; display: flex; flex-direction: column; max-height: 600px; }
    .preview-header { padding: 12px 16px; background: var(--surface, #1e293b); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; min-height: 48px; }
    .preview-product-name { font-size: 15px; font-weight: 700; color: var(--text, #f1f5f9); }
    .preview-logo { max-height: 30px; }
    .preview-body { display: flex; flex: 1; overflow: hidden; min-height: 260px; }
    .preview-sidebar { width: 150px; background: var(--surface, #1e293b); padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.06); }
    .preview-nav-item { padding: 7px 10px; border-radius: 7px; font-size: 11px; color: rgba(255,255,255,0.55); cursor: default; }
    .preview-nav-item.active { background: var(--primary, #6366f1); color: #fff; }
    .preview-content { flex: 1; background: var(--bg, #0f172a); padding: 14px; overflow: hidden; }
    .preview-chat { display: flex; flex-direction: column; gap: 10px; }
    .preview-msg { max-width: 85%; padding: 8px 12px; border-radius: 10px; font-size: 11px; line-height: 1.5; }
    .preview-msg.user { align-self: flex-end; background: var(--primary, #6366f1); color: #fff; }
    .preview-msg.ai { align-self: flex-start; background: var(--surface, #1e293b); color: var(--text, #f1f5f9); }
    .preview-footer { padding: 8px 16px; background: var(--surface, #1e293b); text-align: center; font-size: 11px; color: rgba(255,255,255,0.35); border-top: 1px solid rgba(255,255,255,0.06); min-height: 32px; display: flex; align-items: center; justify-content: center; }
  `]
})
export class BrandingConfigComponent implements OnInit {
  private adminService = inject(AdminService);

  @ViewChild('logoInput')    private logoInputEl!:    ElementRef<HTMLInputElement>;
  @ViewChild('faviconInput') private faviconInputEl!: ElementRef<HTMLInputElement>;

  saving      = signal(false);
  saved       = signal(false);
  previewMode = signal(false);
  verifying   = signal(false);

  readonly fontPresets = FONT_PRESETS;

  form: AdminBrandingConfig = {
    platformName: '', tagline: '', companyName: '',
    logoUrl: null, logoMarkUrl: null, logoDarkUrl: null, faviconUrl: null,
    theme: {
      ...DEFAULT_THEME,
      primary: '#6366f1', primaryHover: '#4f46e5', primaryLight: '#e0e7ff',
      secondary: '#8b5cf6',
      background: '#0f172a', surface: '#1e293b', surfaceHover: '#334155',
      sidebarBg: '#0f172a', sidebarText: '#e2e8f0', sidebarActiveItem: '#6366f1',
      textPrimary: '#f1f5f9', textSecondary: '#94a3b8', textOnPrimary: '#ffffff',
      border: '#334155', borderFocus: '#6366f1',
      success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyMono: 'JetBrains Mono, monospace',
      borderRadius: '8px', borderRadiusLg: '12px', borderRadiusFull: '9999px',
      customCss: '',
    },
    subdomain: '', customDomain: null, customDomainStatus: null,
    emailFromName: '', emailFromAddress: null,
    chatWelcomeMessage: 'Olá! Como posso ajudar?',
    chatPlaceholder: 'Digite sua mensagem...',
    chatBotName: 'Assistente', chatBotAvatar: null,
    loginPageTitle: null, loginPageSubtitle: null, loginBackgroundUrl: null,
    termsUrl: null, privacyUrl: null, supportEmail: null, supportUrl: null,
    featureFlags: {
      showPoweredBy: true,
      showDocumentation: true,
      showChangelog: true,
      showSupportChat: false,
      allowUserRegistration: false,
    },
  };

  colorFields: { key: ThemeColorKey; label: string }[] = [
    { key: 'primary',     label: 'Cor primária' },
    { key: 'secondary',   label: 'Cor secundária' },
    { key: 'background',  label: 'Background' },
    { key: 'surface',     label: 'Surface/Cards' },
    { key: 'textPrimary', label: 'Texto' },
    { key: 'border',      label: 'Bordas' },
  ];

  colorPresets = [
    { name: 'BTV Dark',   primary: '#6366f1', secondary: '#8b5cf6', background: '#0f172a', surface: '#1e293b', textPrimary: '#f1f5f9' },
    { name: 'Ocean',      primary: '#0ea5e9', secondary: '#06b6d4', background: '#0c1a2e', surface: '#1a2d4a', textPrimary: '#e0f2fe' },
    { name: 'Forest',     primary: '#16a34a', secondary: '#15803d', background: '#0a1a0f', surface: '#14291c', textPrimary: '#dcfce7' },
    { name: 'Sunset',     primary: '#f97316', secondary: '#ef4444', background: '#1a0a00', surface: '#2d1500', textPrimary: '#fff7ed' },
    { name: 'Light',      primary: '#6366f1', secondary: '#8b5cf6', background: '#f8fafc', surface: '#ffffff', textPrimary: '#0f172a' },
  ];

  featureToggles: { key: keyof FeatureFlags; label: string; hint?: string }[] = [
    { key: 'showPoweredBy',         label: 'Exibir "Powered by BTV Chat"', hint: 'Desative para white-label completo' },
    { key: 'showDocumentation',     label: 'Link de Documentação' },
    { key: 'showChangelog',         label: 'Changelog / Novidades' },
    { key: 'showSupportChat',       label: 'Chat de Suporte ao Vivo' },
    { key: 'allowUserRegistration', label: 'Auto-cadastro de usuários' },
  ];

  selectedFont = signal('Inter, system-ui, sans-serif');

  ngOnInit(): void {
    this.adminService.getBranding().subscribe((b) => {
      this.form = { ...b };
      const preset = FONT_PRESETS.find(f => f.value === b.theme?.fontFamily);
      this.selectedFont.set(preset ? preset.value : '__custom__');
    });
  }

  save(): void {
    this.saving.set(true);
    this.adminService.updateBranding(this.form).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 3000); },
      error: () => this.saving.set(false),
    });
  }

  applyPreset(preset: typeof this.colorPresets[0]): void {
    this.form.theme = {
      ...this.form.theme,
      primary: preset.primary,
      secondary: preset.secondary,
      background: preset.background,
      surface: preset.surface,
      textPrimary: preset.textPrimary,
    };
  }

  onFontChange(value: string): void {
    this.selectedFont.set(value);
    if (value !== '__custom__') {
      this.form.theme = { ...this.form.theme, fontFamily: value };
    }
  }

  previewCssVars(): string {
    const t = this.form.theme;
    return `--primary:${t.primary};--secondary:${t.secondary};--bg:${t.background};--surface:${t.surface};--text:${t.textPrimary}`;
  }

  uploadLogo():    void { this.logoInputEl?.nativeElement.click(); }
  uploadFavicon(): void { this.faviconInputEl?.nativeElement.click(); }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { this.form.logoUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  onFaviconChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { this.form.faviconUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  verifyDomain(): void {
    if (!this.form.customDomain) return;
    this.verifying.set(true);
    this.adminService.verifyBrandingDomain(this.form.customDomain).subscribe({
      next: (res) => { this.form.customDomainStatus = res.status; this.verifying.set(false); },
      error: () => { this.form.customDomainStatus = 'failed'; this.verifying.set(false); },
    });
  }

  toggleFeature(key: keyof FeatureFlags): void {
    if (this.form.featureFlags) {
      this.form.featureFlags = { ...this.form.featureFlags, [key]: !this.form.featureFlags[key] };
    }
  }
}
