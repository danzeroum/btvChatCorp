import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, ApiKeyAdmin } from '../admin.service';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="api-keys">
      <div class="page-header">
        <div><h1>Chaves de API</h1><p>Gerencie integrações com sistemas externos</p></div>
        <button class="btn-primary" (click)="showCreate = true">+ Nova chave</button>
      </div>

      <!-- Chave recém criada -->
      <div class="new-key-banner" *ngIf="newKeyValue">
        <strong>🔑 Copie agora — não será mostrada novamente:</strong>
        <code>{{ newKeyValue }}</code>
        <button (click)="copyKey(newKeyValue)">Copiar</button>
        <button class="close" (click)="newKeyValue = null">×</button>
      </div>

      <!-- Modal criar chave -->
      <div class="modal-overlay" *ngIf="showCreate" (click)="showCreate = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Nova chave de API</h2>
          <div class="form-group">
            <label>Nome</label>
            <input [(ngModel)]="newKey.name" placeholder="ERP Integration">
          </div>
          <div class="form-group">
            <label>Rate limit (req/min)</label>
            <input type="number" [(ngModel)]="newKey.rateLimit" min="1" max="1000">
          </div>
          <div class="form-group">
            <label>Permissões</label>
            <div class="perms">
              <label *ngFor="let r of resources" class="perm-check">
                <input type="checkbox"
                  [checked]="hasPermission(r)"
                  (change)="togglePermission(r)">
                {{ r }}
              </label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="showCreate = false">Cancelar</button>
            <button class="btn-primary" (click)="createKey()">Criar</button>
          </div>
        </div>
      </div>

      <!-- Lista de chaves -->
      <div class="key-list">
        <div *ngFor="let key of apiKeys" class="key-card" [class.revoked]="key.status !== 'active'">
          <div class="key-header">
            <div>
              <strong>{{ key.name }}</strong>
              <code class="prefix">{{ key.prefix }}...</code>
            </div>
            <span class="status-badge" [class]="'s-' + key.status">{{ key.status }}</span>
          </div>
          <div class="key-meta">
            <span>{{ key.rateLimit }} req/min</span>
            <span>Último uso: {{ key.lastUsedAt ? (key.lastUsedAt | date:'dd/MM/yyyy') : 'nunca' }}</span>
            <span>{{ (key.usageTotal ?? 0) | number }} requests</span>
            <span *ngIf="key.expiresAt">Expira: {{ key.expiresAt | date:'dd/MM/yyyy' }}</span>
          </div>
          <div class="key-actions" *ngIf="key.status === 'active'">
            <button class="danger" (click)="revoke(key)">Revogar</button>
          </div>
        </div>
      </div>

      <!-- Link Swagger -->
      <div class="swagger-link">
        <strong>Documentação da API</strong>
        <p>Integre com ERP, n8n, Zapier ou qualquer sistema externo.</p>
        <a [href]="swaggerUrl" target="_blank" class="btn-secondary">Abrir Swagger UI ↗</a>
      </div>
    </div>
  `,
  styleUrls: ['./api-keys.component.scss'],
})
export class ApiKeysComponent implements OnInit {
  private adminService = inject(AdminService);
  apiKeys: ApiKeyAdmin[] = [];
  showCreate = false;
  newKeyValue: string | null = null;
  swaggerUrl = `${window.location.origin}/api-docs`;
  resources = ['chat', 'documents', 'search', 'training', 'webhooks', 'usage'];
  newKey: { name: string; rateLimit: number; selectedResources: string[] } = {
    name: '', rateLimit: 60, selectedResources: ['chat', 'search'],
  };

  ngOnInit() { this.loadKeys(); }

  loadKeys() {
    this.adminService.listApiKeys().subscribe((k) => (this.apiKeys = k));
  }

  hasPermission(r: string): boolean {
    return this.newKey.selectedResources?.includes(r) ?? false;
  }

  togglePermission(r: string) {
    const sr = this.newKey.selectedResources!;
    const idx = sr.indexOf(r);
    idx === -1 ? sr.push(r) : sr.splice(idx, 1);
  }

  createKey() {
    this.adminService.createApiKey({
      name: this.newKey.name,
      rateLimit: this.newKey.rateLimit,
      permissions: this.newKey.selectedResources,
    }).subscribe(({ key }) => {
      this.newKeyValue = key;
      this.showCreate = false;
      this.loadKeys();
    });
  }

  revoke(key: ApiKeyAdmin) {
    if (!confirm(`Revogar "${key.name}"? Esta ação não pode ser desfeita.`)) return;
    this.adminService.revokeApiKey(key.id).subscribe(() => (key.status = 'revoked'));
  }

  copyKey(value: string) {
    navigator.clipboard.writeText(value);
  }
}
