import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, SsoConfig } from '../admin.service';

@Component({
  selector: 'app-sso-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sso-config">
      <h1>Configuração de SSO</h1>
      <p class="subtitle">Integre o login com Google, Microsoft ou SAML 2.0</p>

      <div class="config-card" *ngIf="cfg">
        <!-- Ativar SSO -->
        <div class="toggle-row">
          <div>
            <strong>SSO Ativo</strong>
            <p>Usuários poderão fazer login com o provedor configurado</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" [(ngModel)]="cfg.enabled">
            <span class="slider"></span>
          </label>
        </div>

        <div *ngIf="cfg.enabled">
          <!-- Seleção de provedor -->
          <div class="form-group">
            <label>Provedor</label>
            <div class="provider-cards">
              <div class="provider-card" [class.selected]="cfg.provider === 'google'"
                (click)="cfg.provider = 'google'">
                <span class="provider-icon">G</span> Google Workspace
              </div>
              <div class="provider-card" [class.selected]="cfg.provider === 'microsoft'"
                (click)="cfg.provider = 'microsoft'">
                <span class="provider-icon ms">⊞</span> Microsoft 365
              </div>
              <div class="provider-card" [class.selected]="cfg.provider === 'saml'"
                (click)="cfg.provider = 'saml'">
                <span class="provider-icon saml">S</span> SAML 2.0
              </div>
            </div>
          </div>

          <!-- Google / Microsoft -->
          <ng-container *ngIf="cfg.provider === 'google' || cfg.provider === 'microsoft'">
            <div class="form-group">
              <label>Client ID</label>
              <input [(ngModel)]="cfg.clientId" placeholder="Seu OAuth Client ID">
            </div>
            <div class="form-group" *ngIf="cfg.provider === 'microsoft'">
              <label>Tenant ID</label>
              <input [(ngModel)]="cfg.tenantId" placeholder="Seu Azure Tenant ID">
            </div>
          </ng-container>

          <!-- SAML -->
          <div class="form-group" *ngIf="cfg.provider === 'saml'">
            <label>Metadata URL</label>
            <input [(ngModel)]="cfg.samlMetadataUrl" placeholder="https://idp.empresa.com/metadata.xml">
          </div>

          <!-- Auto-provisionamento -->
          <div class="toggle-row">
            <div>
              <strong>Auto-provisionamento</strong>
              <p>Cria usuário automaticamente no primeiro login SSO</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="cfg.autoProvision">
              <span class="slider"></span>
            </label>
          </div>

          <!-- Role padrão -->
          <div class="form-group">
            <label>Role padrão para novos usuários</label>
            <select [(ngModel)]="cfg.defaultRole">
              <option value="member">Membro</option>
              <option value="curator">Curador de dados</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        <div class="actions">
          <button class="btn-primary" (click)="save()" [disabled]="saving">
            {{ saving ? 'Salvando...' : 'Salvar configurações' }}
          </button>
          <span class="saved-msg" *ngIf="saved">✅ Salvo!</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./sso-config.component.scss'],
})
export class SsoConfigComponent implements OnInit {
  private adminService = inject(AdminService);
  cfg: SsoConfig | null = null;
  saving = false;
  saved = false;

  ngOnInit() {
    this.adminService.getSsoConfig().subscribe((c) => (this.cfg = c));
  }

  save() {
    if (!this.cfg) return;
    this.saving = true;
    this.adminService.updateSsoConfig(this.cfg).subscribe(() => {
      this.saving = false;
      this.saved = true;
      setTimeout(() => (this.saved = false), 3000);
    });
  }
}
