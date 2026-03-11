import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiKey, ApiKeyCreateRequest, ApiKeyCreated, ApiResource, ApiAction } from '../../../core/models/api-public.model';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="api-keys">
      <div class="page-header">
        <div>
          <h1>&#128273; Chaves de API</h1>
          <p>Gerencie chaves para integrar com sistemas externos.</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Nova Chave</button>
      </div>

      <!-- Chaves existentes -->
      @if (loading()) {
        <div class="loading-state">Carregando...</div>
      } @else if (apiKeys().length === 0) {
        <div class="empty-state">
          <span>&#128273;</span>
          <p>Nenhuma chave criada ainda.</p>
        </div>
      } @else {
        @for (key of apiKeys(); track key.id) {
          <div class="key-card" [class.revoked]="key.status === 'revoked'" [class.expired]="key.status === 'expired'">
            <div class="key-header">
              <div>
                <h3>{{ key.name }}</h3>
                @if (key.description) { <p class="key-desc">{{ key.description }}</p> }
              </div>
              <span class="key-status" [class]="key.status">{{ key.status | titlecase }}</span>
            </div>

            <div class="key-value">
              <code>{{ key.keyPrefix }}••••••••••••••••</code>
              <span class="key-scope">Escopo: {{ key.projectScope === 'all' ? 'Todos os projetos' : key.allowedProjectIds?.length + ' projeto(s)' }}</span>
            </div>

            <div class="key-permissions">
              @for (perm of key.permissions; track perm.resource) {
                <span class="perm-badge">{{ perm.resource }}: {{ perm.actions.join(', ') }}</span>
              }
            </div>

            <div class="key-meta">
              <span>Criada {{ key.createdAt | date:'dd/MM/yyyy' }}</span>
              <span>\xDAltimo uso: {{ key.lastUsedAt ? (key.lastUsedAt | date:'dd/MM HH:mm') : 'Nunca' }}</span>
              <span>Requests 30d: {{ key.totalRequests | number }}</span>
              @if (key.expiresAt) {
                <span [class.expiring]="isExpiringSoon(key)">
                  Expira {{ key.expiresAt | date:'dd/MM/yyyy' }}
                </span>
              }
              @if (key.rateLimit) {
                <span>Rate limit: {{ key.rateLimit }} RPM</span>
              }
            </div>

            <div class="key-actions">
              <button (click)="editKey(key)">Editar</button>
              <button (click)="rotateKey(key)">Rotacionar</button>
              @if (key.status === 'active') {
                <button class="danger" (click)="revokeKey(key)">Revogar</button>
              }
            </div>
          </div>
        }
      }

      <!-- Link para Swagger -->
      <div class="api-docs-link">
        <h3>Documenta\xE7\xE3o da API</h3>
        <p>Acesse a documenta\xE7\xE3o interativa Swagger/OpenAPI para integrar com seus sistemas.</p>
        <a [href]="apiDocsUrl" target="_blank" class="btn-secondary">Abrir Swagger UI &#8599;</a>
      </div>
    </div>

    <!-- Modal de cria\xE7\xE3o -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingKey() ? 'Editar' : 'Nova' }} Chave de API</h2>
            <button (click)="closeModal()">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nome *
                <input [(ngModel)]="form.name" placeholder="Ex: ERP Integration" autofocus />
              </label>
            </div>
            <div class="form-group">
              <label>Descri\xE7\xE3o
                <input [(ngModel)]="form.description" placeholder="Para qu\xEA serve esta chave?" />
              </label>
            </div>

            <!-- Permiss\xF5es -->
            <div class="form-group">
              <label>Permiss\xF5es</label>
              <div class="permissions-grid">
                @for (resource of resources; track resource) {
                  <div class="perm-row">
                    <strong>{{ resource }}</strong>
                    @for (action of actions; track action) {
                      <label class="checkbox-label">
                        <input type="checkbox"
                          [checked]="hasPermission(resource, action)"
                          (change)="togglePermission(resource, action, $any($event.target).checked)" />
                        {{ action }}
                      </label>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Rate Limit (RPM)
                  <input type="number" [(ngModel)]="form.rateLimit" min="1" />
                </label>
              </div>
              <div class="form-group">
                <label>Expira\xE7\xE3o (opcional)
                  <input type="date" [(ngModel)]="form.expiresAt" />
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>IPs permitidos (um por linha, vazio = qualquer)
                <textarea [(ngModel)]="allowedIpsText" rows="3" placeholder="200.123.45.0/24"></textarea>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="saveKey()" [disabled]="!form.name.trim() || saving()">
              {{ saving() ? 'Salvando...' : (editingKey() ? 'Salvar' : 'Criar Chave') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: chave criada -- exibir APENAS uma vez -->
    @if (newKeyPlain()) {
      <div class="modal-overlay">
        <div class="modal key-reveal-modal">
          <div class="modal-header">
            <h2>&#9989; Chave criada com sucesso!</h2>
          </div>
          <div class="modal-body">
            <div class="alert warning">
              &#9888;&#65039; <strong>Copie agora.</strong> Esta chave n\xE3o ser\xE1 exibida novamente.
            </div>
            <div class="key-reveal">
              <code>{{ newKeyPlain() }}</code>
              <button (click)="copyNewKey()">{{ keyCopied() ? '\u2705 Copiado!' : '\uD83D\uDCCB Copiar' }}</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" (click)="newKeyPlain.set(null)">Entendido, guardei a chave</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ApiKeysComponent implements OnInit {
  private http = inject(HttpClient);

  loading  = signal(true);
  saving   = signal(false);
  showModal  = signal(false);
  editingKey = signal<ApiKey | null>(null);
  apiKeys  = signal<ApiKey[]>([]);
  newKeyPlain = signal<string | null>(null);
  keyCopied  = signal(false);
  allowedIpsText = '';

  resources: ApiResource[] = ['chat', 'documents', 'projects', 'search', 'training', 'usage', 'webhooks'];
  actions: ApiAction[]     = ['read', 'write', 'delete'];

  apiDocsUrl = '/api/docs';

  form: ApiKeyCreateRequest = this.emptyForm();

  ngOnInit(): void {
    this.loadKeys();
  }

  loadKeys(): void {
    this.http.get<ApiKey[]>('/api/admin/api-keys').subscribe({
      next: (keys) => { this.apiKeys.set(keys); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingKey.set(null);
    this.form = this.emptyForm();
    this.allowedIpsText = '';
    this.showModal.set(true);
  }

  editKey(key: ApiKey): void {
    this.editingKey.set(key);
    this.form = {
      name: key.name,
      description: key.description,
      permissions: [...key.permissions],
      rateLimit: key.rateLimit,
      projectScope: key.projectScope,
      allowedProjectIds: key.allowedProjectIds,
      expiresAt: key.expiresAt,
    };
    this.allowedIpsText = (key.allowedIps ?? []).join('\n');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingKey.set(null);
  }

  hasPermission(resource: ApiResource, action: ApiAction): boolean {
    return this.form.permissions.some((p) => p.resource === resource && p.actions.includes(action));
  }

  togglePermission(resource: ApiResource, action: ApiAction, checked: boolean): void {
    const existing = this.form.permissions.find((p) => p.resource === resource);
    if (checked) {
      if (existing) {
        existing.actions = [...new Set([...existing.actions, action])];
      } else {
        this.form.permissions.push({ resource, actions: [action] });
      }
    } else {
      if (existing) {
        existing.actions = existing.actions.filter((a) => a !== action);
        if (existing.actions.length === 0) {
          this.form.permissions = this.form.permissions.filter((p) => p.resource !== resource);
        }
      }
    }
  }

  saveKey(): void {
    this.saving.set(true);
    this.form.allowedIps = this.allowedIpsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const editing = this.editingKey();
    const req$ = editing
      ? this.http.put<ApiKey>(`/api/admin/api-keys/${editing.id}`, this.form)
      : this.http.post<ApiKeyCreated>('/api/admin/api-keys', this.form);

    req$.subscribe({
      next: (result: any) => {
        this.loadKeys();
        this.closeModal();
        this.saving.set(false);
        if (!editing && result.plainKey) {
          this.newKeyPlain.set(result.plainKey);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  revokeKey(key: ApiKey): void {
    if (!confirm(`Revogar a chave "${key.name}"? Esta a\xE7\xE3o n\xE3o pode ser desfeita.`)) return;
    this.http.post(`/api/admin/api-keys/${key.id}/revoke`, {}).subscribe(() => this.loadKeys());
  }

  rotateKey(key: ApiKey): void {
    if (!confirm(`Rotacionar a chave "${key.name}"? A chave atual ser\xE1 invalidada imediatamente.`)) return;
    this.http.post<ApiKeyCreated>(`/api/admin/api-keys/${key.id}/rotate`, {}).subscribe((result) => {
      this.loadKeys();
      this.newKeyPlain.set(result.plainKey);
    });
  }

  copyNewKey(): void {
    navigator.clipboard.writeText(this.newKeyPlain() ?? '');
    this.keyCopied.set(true);
    setTimeout(() => this.keyCopied.set(false), 2000);
  }

  isExpiringSoon(key: ApiKey): boolean {
    if (!key.expiresAt) return false;
    const diff = new Date(key.expiresAt).getTime() - Date.now();
    return diff < 7 * 24 * 60 * 60 * 1000; // 7 dias
  }

  private emptyForm(): ApiKeyCreateRequest {
    return { name: '', description: '', permissions: [], rateLimit: 60, projectScope: 'all' };
  }
}
