import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, SsoConfig } from '../admin.service';
import { ToggleComponent } from '../shared/toggle.component';

@Component({
  selector: 'app-sso-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToggleComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Configuração SSO</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Configuração de SSO</h1>
          <p class="page-sub">Integre o login com Google, Microsoft, Okta ou SAML 2.0</p>
        </div>
        <button class="btn-primary" (click)="save()" [disabled]="saving()">
          {{ saving() ? 'Salvando…' : 'Salvar configurações' }}
        </button>
      </div>

      @if (saved()) {
        <div class="toast-bar">Configurações salvas com sucesso.</div>
      }

      @if (cfg()) {
        <div class="config-section">
          <div class="toggle-row">
            <div class="toggle-label-col">
              <span class="toggle-title">SSO Ativo</span>
              <span class="toggle-hint">Usuários poderão fazer login com o provedor configurado</span>
            </div>
            <app-toggle [(ngModel)]="ssoEnabled" />
          </div>
        </div>

        @if (ssoEnabled) {
          <div class="config-section">
            <h2 class="section-title">Provedor</h2>
            <div class="provider-grid">
              @for (p of providers; track p.id) {
                <button class="provider-card" [class.provider-active]="selectedProvider === p.id"
                        (click)="selectedProvider = p.id">
                  <span class="provider-logo">{{ p.logo }}</span>
                  <span class="provider-name">{{ p.name }}</span>
                  @if (selectedProvider === p.id) { <span class="provider-check">✓</span> }
                </button>
              }
            </div>
          </div>

          @if (selectedProvider === 'google' || selectedProvider === 'microsoft') {
            <div class="config-section">
              <h2 class="section-title">Credenciais OAuth</h2>
              <div class="form-col">
                <label>Client ID
                  <input [(ngModel)]="clientId" class="form-input" placeholder="Seu OAuth Client ID" />
                </label>
                @if (selectedProvider === 'microsoft') {
                  <label>Tenant ID
                    <input [(ngModel)]="tenantId" class="form-input" placeholder="Seu Azure Tenant ID" />
                  </label>
                }
              </div>
            </div>
          }

          @if (selectedProvider === 'okta') {
            <div class="config-section">
              <h2 class="section-title">Credenciais Okta</h2>
              <div class="form-col">
                <label>Domain
                  <input [(ngModel)]="oktaDomain" class="form-input" placeholder="empresa.okta.com" />
                </label>
                <label>Client ID
                  <input [(ngModel)]="clientId" class="form-input" placeholder="Seu Okta Client ID" />
                </label>
              </div>
            </div>
          }

          @if (selectedProvider === 'saml') {
            <div class="config-section">
              <h2 class="section-title">SAML 2.0</h2>
              <label>Metadata URL
                <input [(ngModel)]="samlUrl" class="form-input" placeholder="https://idp.empresa.com/metadata.xml" />
              </label>
            </div>
          }

          <div class="config-section">
            <h2 class="section-title">Domínios permitidos</h2>
            <div class="domains-row">
              @for (d of domains; track d.domain) {
                <span class="domain-chip" [class.verified]="d.verified">
                  {{ d.domain }}
                  @if (d.verified) { <span class="domain-check">✓</span> }
                </span>
              }
              <button class="chip-add" (click)="addDomain()">+ Domínio</button>
            </div>
          </div>

          <div class="config-section">
            <h2 class="section-title">Políticas de sessão</h2>
            <div class="policy-list">
              @for (pol of sessionPolicies; track pol.key) {
                <div class="toggle-row">
                  <div class="toggle-label-col">
                    <span class="toggle-title">{{ pol.label }}</span>
                    <span class="toggle-hint">{{ pol.hint }}</span>
                  </div>
                  <app-toggle [(ngModel)]="pol.enabled" />
                </div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="toggle-row">
              <div class="toggle-label-col">
                <span class="toggle-title">Auto-provisionamento</span>
                <span class="toggle-hint">Cria conta automaticamente no primeiro login SSO</span>
              </div>
              <app-toggle [(ngModel)]="autoProvision" />
            </div>
            @if (autoProvision) {
              <div class="form-col mt-16">
                <label>Papel padrão
                  <select [(ngModel)]="defaultRole" class="form-select">
                    <option value="member">Membro</option>
                    <option value="curator">Curador de dados</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>
            }
          </div>
        }
      } @else {
        <div class="loading-state">Carregando…</div>
      }
    </div>
  `,
  styles: [`
    .admin-page { padding: 28px 32px; max-width: 820px; font-family: 'IBM Plex Sans', system-ui, sans-serif; }
    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-3); margin-bottom:16px; }
    .bc-link { color:var(--ink-2); text-decoration:none; }
    .bc-link:hover { color:var(--ink); }
    .bc-sep { color:var(--line); }
    .admin-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .admin-header h1 { font-size:20px; font-weight:600; color:var(--ink); margin:0 0 4px; }
    .page-sub { font-size:13px; color:var(--ink-3); margin:0; }
    .btn-primary { padding:8px 18px; background:var(--acc); color:var(--white); border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    .btn-primary:hover { opacity:.9; }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .toast-bar { background:var(--good-soft); color:var(--good); border:1px solid #b2d8c4; border-radius:8px; padding:10px 16px; font-size:13px; margin-bottom:16px; }
    .config-section { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-bottom:12px; }
    .section-title { font-size:13px; font-weight:600; color:var(--ink); margin:0 0 14px; }
    .toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .toggle-row + .toggle-row { margin-top:14px; padding-top:14px; border-top:1px solid var(--line-2); }
    .toggle-label-col { display:flex; flex-direction:column; gap:3px; }
    .toggle-title { font-size:13px; font-weight:500; color:var(--ink); }
    .toggle-hint { font-size:12px; color:var(--ink-3); }
    .provider-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
    .provider-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 12px; border:1px solid var(--line); border-radius:10px; background:var(--white); cursor:pointer; font-size:12px; font-weight:500; color:var(--ink-2); position:relative; transition:all .15s; }
    .provider-card:hover { border-color:var(--acc-line); background:var(--acc-soft); }
    .provider-active { border-color:var(--acc); background:var(--acc-soft); color:var(--acc); }
    .provider-logo { font-size:22px; }
    .provider-name { font-size:12px; }
    .provider-check { position:absolute; top:8px; right:8px; font-size:10px; color:var(--acc); font-weight:700; }
    .form-col { display:flex; flex-direction:column; gap:12px; }
    .form-col label { font-size:12px; font-weight:500; color:var(--ink-2); display:flex; flex-direction:column; gap:5px; }
    .form-input { background:var(--white); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--ink); width:100%; box-sizing:border-box; }
    .form-input:focus { outline:none; border-color:var(--acc); }
    .form-select { background:var(--white); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--ink); width:100%; }
    .mt-16 { margin-top:16px; }
    .domains-row { display:flex; flex-wrap:wrap; gap:8px; }
    .domain-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:999px; border:1px solid var(--line); background:var(--panel-2); font-size:12px; color:var(--ink-2); }
    .domain-chip.verified { border-color:var(--good); background:var(--good-soft); color:var(--good); }
    .domain-check { font-size:10px; }
    .chip-add { padding:4px 12px; border-radius:999px; border:1px dashed var(--line); background:none; font-size:12px; color:var(--ink-3); cursor:pointer; }
    .chip-add:hover { border-color:var(--acc); color:var(--acc); }
    .policy-list { display:flex; flex-direction:column; gap:0; }
    .loading-state { text-align:center; padding:48px; color:var(--ink-3); font-size:14px; }
  `],
})
export class SsoConfigComponent implements OnInit {
  private adminSvc = inject(AdminService);

  cfg    = signal<SsoConfig | null>(null);
  saving = signal(false);
  saved  = signal(false);

  ssoEnabled       = false;
  selectedProvider = 'google';
  clientId         = '';
  tenantId         = '';
  oktaDomain       = '';
  samlUrl          = '';
  autoProvision    = true;
  defaultRole      = 'member';

  providers = [
    { id: 'google',    name: 'Google',    logo: 'G' },
    { id: 'microsoft', name: 'Microsoft', logo: '⊞' },
    { id: 'okta',      name: 'Okta',      logo: 'O' },
    { id: 'saml',      name: 'SAML 2.0',  logo: 'S' },
  ];

  domains = [
    { domain: 'empresa.com.br', verified: true },
    { domain: 'filial.com',     verified: false },
  ];

  sessionPolicies = [
    { key: 'mfa_required',      label: 'MFA obrigatório via SSO',  hint: 'Exige MFA mesmo com login federado',              enabled: false },
    { key: 'force_reauth_30d',  label: 'Reautenticação 30 dias',   hint: 'Sessão expira após 30 dias mesmo com SSO ativo', enabled: true  },
    { key: 'block_local_login', label: 'Bloquear login local',      hint: 'Apenas SSO é permitido para o domínio',          enabled: false },
  ];

  ngOnInit(): void {
    this.adminSvc.getSsoConfig().subscribe((c) => {
      this.cfg.set(c);
      this.ssoEnabled       = c.enabled ?? false;
      this.selectedProvider = c.provider ?? 'google';
      this.clientId         = c.clientId ?? '';
      this.tenantId         = c.tenantId ?? '';
      this.samlUrl          = c.samlMetadataUrl ?? '';
      this.autoProvision    = c.autoProvision ?? true;
      this.defaultRole      = c.defaultRole ?? 'member';
    });
  }

  addDomain(): void {
    const d = prompt('Domínio (ex: empresa.com.br):');
    if (d?.trim()) this.domains.push({ domain: d.trim(), verified: false });
  }

  save(): void {
    const c = this.cfg();
    if (!c) return;
    this.saving.set(true);
    const provider = (['google', 'microsoft', 'saml', 'none'] as const).includes(this.selectedProvider as any)
      ? (this.selectedProvider as SsoConfig['provider'])
      : 'none';
    this.adminSvc.updateSsoConfig({
      ...c,
      enabled:       this.ssoEnabled,
      provider,
      clientId:      this.clientId,
      tenantId:      this.tenantId,
      samlMetadataUrl: this.samlUrl,
      autoProvision: this.autoProvision,
      defaultRole:   this.defaultRole,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => this.saving.set(false),
    });
  }
}
