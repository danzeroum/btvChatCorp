import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface BrandingConfig {
  // Identidade visual
  productName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  // Cores
  primaryColor: string;      // hex
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  // Tipografia
  fontFamily: 'inter' | 'roboto' | 'poppins' | 'custom';
  customFontUrl: string;
  // Domínio
  customDomain: string | null;
  customDomainStatus: 'pending' | 'verified' | 'failed' | null;
  // Footer / Legais
  showPoweredBy: boolean;
  termsUrl: string;
  privacyUrl: string;
  supportEmail: string;
  // Funcionalidades visíveis
  features: {
    showTrainingSection: boolean;
    showBillingSection: boolean;
    showApiKeys: boolean;
    showAuditLog: boolean;
  };
}

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
                <label>Nome do produto
                  <input [(ngModel)]="form.productName" placeholder="Minha Plataforma AI" />
                </label>
              </div>
              <div class="form-group">
                <label>Tagline
                  <input [(ngModel)]="form.tagline" placeholder="Inteligência artificial para sua empresa" />
                </label>
              </div>
            </div>

            <div class="upload-row">
              <div class="upload-group">
                <label>Logo (PNG/SVG, 200×60px recomendado)</label>
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
                    <input type="color" [(ngModel)]="form[col.key]" />
                    <input type="text" [(ngModel)]="form[col.key]" placeholder="#6366f1" maxlength="7" />
                  </div>
                </div>
              }
            </div>
            <!-- Presets -->
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
                <select [(ngModel)]="form.fontFamily">
                  <option value="inter">Inter (padrão)</option>
                  <option value="roboto">Roboto</option>
                  <option value="poppins">Poppins</option>
                  <option value="custom">Personalizada (URL)</option>
                </select>
              </label>
            </div>
            @if (form.fontFamily === 'custom') {
              <div class="form-group">
                <label>URL da fonte (Google Fonts ou CDN)
                  <input [(ngModel)]="form.customFontUrl" placeholder="https://fonts.googleapis.com/css2?family=..." />
                </label>
              </div>
            }
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
            </div>
            <label class="toggle-label">
              <div>
                <span>Exibir "Powered by BTV Chat"</span>
                <span class="hint">Desative para white-label completo</span>
              </div>
              <div class="toggle-switch" [class.on]="form.showPoweredBy" (click)="form.showPoweredBy = !form.showPoweredBy">
                <div class="toggle-knob"></div>
              </div>
            </label>
          </section>

          <!-- Features visíveis -->
          <section class="settings-section">
            <h2>&#128270; Seções Visíveis</h2>
            <p class="hint">Controle quais seções do admin ficam visíveis para os administradores dos workspaces revendidos.</p>
            <div class="toggle-group">
              @for (feat of featureToggles; track feat.key) {
                <label class="toggle-label">
                  <span>{{ feat.label }}</span>
                  <div class="toggle-switch" [class.on]="form.features?.[feat.key]" (click)="toggleFeature(feat.key)">
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
                <span class="preview-product-name">{{ form.productName || 'Seu Produto' }}</span>
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
              @if (form.showPoweredBy) {
                <span>Powered by BTV Chat</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class BrandingConfigComponent implements OnInit {
  private http      = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  saving      = signal(false);
  saved       = signal(false);
  previewMode = signal(false);
  verifying   = signal(false);

  form: BrandingConfig = {
    productName: '', tagline: '', logoUrl: null, faviconUrl: null,
    primaryColor: '#6366f1', secondaryColor: '#8b5cf6', accentColor: '#06b6d4',
    bgColor: '#0f172a', surfaceColor: '#1e293b', textColor: '#f1f5f9',
    fontFamily: 'inter', customFontUrl: '',
    customDomain: null, customDomainStatus: null,
    showPoweredBy: true, termsUrl: '', privacyUrl: '', supportEmail: '',
    features: { showTrainingSection: true, showBillingSection: true, showApiKeys: true, showAuditLog: true },
  };

  colorFields: { key: keyof BrandingConfig; label: string }[] = [
    { key: 'primaryColor',   label: 'Cor primária' },
    { key: 'secondaryColor', label: 'Cor secundária' },
    { key: 'accentColor',    label: 'Destaque' },
    { key: 'bgColor',        label: 'Background' },
    { key: 'surfaceColor',   label: 'Surface/Cards' },
    { key: 'textColor',      label: 'Texto' },
  ];

  colorPresets = [
    { name: 'BTV Dark',   primary: '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4', bg: '#0f172a', surface: '#1e293b', text: '#f1f5f9' },
    { name: 'Ocean',      primary: '#0ea5e9', secondary: '#06b6d4', accent: '#10b981', bg: '#0c1a2e', surface: '#1a2d4a', text: '#e0f2fe' },
    { name: 'Forest',     primary: '#16a34a', secondary: '#15803d', accent: '#84cc16', bg: '#0a1a0f', surface: '#14291c', text: '#dcfce7' },
    { name: 'Sunset',     primary: '#f97316', secondary: '#ef4444', accent: '#fbbf24', bg: '#1a0a00', surface: '#2d1500', text: '#fff7ed' },
    { name: 'Light',      primary: '#6366f1', secondary: '#8b5cf6', accent: '#06b6d4', bg: '#f8fafc', surface: '#ffffff', text: '#0f172a' },
  ];

  featureToggles: { key: keyof BrandingConfig['features']; label: string }[] = [
    { key: 'showTrainingSection', label: 'Seção de Treinamento de IA' },
    { key: 'showBillingSection',  label: 'Seção de Billing e Custos' },
    { key: 'showApiKeys',         label: 'Gerenciamento de API Keys' },
    { key: 'showAuditLog',        label: 'Logs de Auditoria' },
  ];

  ngOnInit(): void {
    this.http.get<BrandingConfig>('/api/admin/branding').subscribe((b) => { this.form = { ...b }; });
  }

  save(): void {
    this.saving.set(true);
    this.http.put('/api/admin/branding', this.form).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 3000); },
      error: () => this.saving.set(false),
    });
  }

  applyPreset(preset: typeof this.colorPresets[0]): void {
    this.form.primaryColor   = preset.primary;
    this.form.secondaryColor = preset.secondary;
    this.form.accentColor    = preset.accent;
    this.form.bgColor        = preset.bg;
    this.form.surfaceColor   = preset.surface;
    this.form.textColor      = preset.text;
  }

  previewCssVars(): string {
    return `--primary:${this.form.primaryColor};--secondary:${this.form.secondaryColor};--accent:${this.form.accentColor};--bg:${this.form.bgColor};--surface:${this.form.surfaceColor};--text:${this.form.textColor}`;
  }

  uploadLogo(): void { (document.querySelector('#logoInput') as HTMLInputElement)?.click(); }
  uploadFavicon(): void { (document.querySelector('#faviconInput') as HTMLInputElement)?.click(); }

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
    this.http.post<{ status: BrandingConfig['customDomainStatus'] }>('/api/admin/branding/verify-domain', { domain: this.form.customDomain })
      .subscribe({
        next: (res) => { this.form.customDomainStatus = res.status; this.verifying.set(false); },
        error: () => { this.form.customDomainStatus = 'failed'; this.verifying.set(false); },
      });
  }

  toggleFeature(key: keyof BrandingConfig['features']): void {
    if (this.form.features) this.form.features[key] = !this.form.features[key];
  }
}
