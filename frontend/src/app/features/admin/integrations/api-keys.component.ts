import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;       // primeiros 8 chars visíveis, ex: "btv_live_"
  maskedKey: string;    // ex: "btv_live_••••••••••••aBcD"
  permissions: string[];
  rateLimit: number;    // requests/min
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'revoked' | 'expired';
  usageToday: number;
  usageTotal: number;
}

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="api-keys">
      <div class="page-header">
        <div>
          <h1>&#128273; API Keys</h1>
          <p>Gerencie chaves de acesso programático à plataforma.</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Nova API Key</button>
      </div>

      <!-- Filtros -->
      <div class="filters-bar">
        <div class="filter-chips">
          @for (s of statusTabs; track s.value) {
            <button class="chip" [class.active]="filterStatus() === s.value" (click)="filterStatus.set(s.value)">
              {{ s.label }} ({{ countByStatus(s.value) }})
            </button>
          }
        </div>
      </div>

      <!-- Lista -->
      <div class="keys-list">
        @if (loading()) {
          <div class="loading-state">Carregando...</div>
        } @else if (filteredKeys().length === 0) {
          <div class="empty-state">Nenhuma API key encontrada.</div>
        } @else {
          @for (key of filteredKeys(); track key.id) {
            <div class="key-card" [class.revoked]="key.status === 'revoked'" [class.expired]="key.status === 'expired'">
              <div class="key-header">
                <div class="key-identity">
                  <span class="key-name">{{ key.name }}</span>
                  <span class="key-masked">{{ key.maskedKey }}</span>
                  <span class="status-badge" [class]="key.status">{{ key.status }}</span>
                </div>
                <div class="key-actions">
                  @if (key.status === 'active') {
                    <button class="btn-secondary btn-sm" (click)="copyKey(key)">&#128203; Copiar</button>
                    <button class="btn-danger btn-sm" (click)="revokeKey(key)">Revogar</button>
                  }
                  <button class="btn-ghost btn-sm" (click)="deleteKey(key)">&#128465;&#65039;</button>
                </div>
              </div>

              <div class="key-details">
                <div class="key-detail">
                  <span class="label">Permissões</span>
                  <div class="permission-chips">
                    @for (perm of key.permissions; track perm) {
                      <span class="perm-chip">{{ perm }}</span>
                    }
                  </div>
                </div>
                <div class="key-detail">
                  <span class="label">Rate limit</span>
                  <span>{{ key.rateLimit }} req/min</span>
                </div>
                <div class="key-detail">
                  <span class="label">Uso hoje</span>
                  <span>{{ key.usageToday | number }} requests</span>
                </div>
                <div class="key-detail">
                  <span class="label">Uso total</span>
                  <span>{{ key.usageTotal | number }}</span>
                </div>
                <div class="key-detail">
                  <span class="label">Último uso</span>
                  <span>{{ key.lastUsedAt ? (key.lastUsedAt | date:'dd/MM/yyyy HH:mm') : 'Nunca' }}</span>
                </div>
                <div class="key-detail">
                  <span class="label">Expira em</span>
                  <span [class.expiring]="isExpiringSoon(key)">{{ key.expiresAt ? (key.expiresAt | date:'dd/MM/yyyy') : 'Nunca' }}</span>
                </div>
                <div class="key-detail">
                  <span class="label">Criada por</span>
                  <span>{{ key.createdBy }} em {{ key.createdAt | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Modal criar -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nova API Key</h2>
            <button (click)="closeModal()">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nome (identificação) *
                <input [(ngModel)]="form.name" placeholder="ex: Integração ERP" />
              </label>
            </div>
            <div class="form-group">
              <label>Permissões
                <div class="perm-checkboxes">
                  @for (perm of availablePermissions; track perm.value) {
                    <label class="checkbox-label">
                      <input type="checkbox" [checked]="form.permissions?.includes(perm.value)"
                        (change)="togglePermission(perm.value, $event)" />
                      {{ perm.label }}
                    </label>
                  }
                </div>
              </label>
            </div>
            <div class="form-group">
              <label>Rate limit (requests/min)
                <input type="number" [(ngModel)]="form.rateLimit" placeholder="60" />
              </label>
            </div>
            <div class="form-group">
              <label>Expiração (opcional)
                <input type="date" [(ngModel)]="form.expiresAt" />
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="createKey()" [disabled]="saving() || !form.name">
              {{ saving() ? 'Gerando...' : 'Gerar API Key' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal com a chave gerada -->
    @if (newKeyValue()) {
      <div class="modal-overlay">
        <div class="modal new-key-modal">
          <div class="modal-header">
            <h2>&#9989; API Key Criada</h2>
          </div>
          <div class="modal-body">
            <div class="new-key-alert">
              &#9888;&#65039; Copie agora! Esta chave <strong>não será exibida novamente</strong>.
            </div>
            <div class="new-key-display">
              <code>{{ newKeyValue() }}</code>
              <button (click)="copyNewKey()">&#128203; Copiar</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" (click)="newKeyValue.set(null)">Entendi, fechar</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ApiKeysComponent implements OnInit {
  private http = inject(HttpClient);

  loading      = signal(false);
  saving       = signal(false);
  showModal    = signal(false);
  newKeyValue  = signal<string | null>(null);
  filterStatus = signal<'all' | 'active' | 'revoked' | 'expired'>('all');
  keys         = signal<ApiKey[]>([]);

  form: Partial<ApiKey> & { permissions: string[] } = this.emptyForm();

  statusTabs = [
    { value: 'all',     label: 'Todas' },
    { value: 'active',  label: 'Ativas' },
    { value: 'revoked', label: 'Revogadas' },
    { value: 'expired', label: 'Expiradas' },
  ];

  availablePermissions = [
    { value: 'chat:read',      label: 'Ler conversas' },
    { value: 'chat:write',     label: 'Criar mensagens' },
    { value: 'documents:read', label: 'Ler documentos' },
    { value: 'documents:write',label: 'Upload de documentos' },
    { value: 'projects:read',  label: 'Ler projetos' },
    { value: 'projects:write', label: 'Criar/editar projetos' },
    { value: 'admin:read',     label: 'Admin (leitura)' },
  ];

  filteredKeys() {
    const s = this.filterStatus();
    return s === 'all' ? this.keys() : this.keys().filter((k) => k.status === s);
  }

  countByStatus(status: string): number {
    return status === 'all' ? this.keys().length : this.keys().filter((k) => k.status === status).length;
  }

  ngOnInit(): void { this.loadKeys(); }

  loadKeys(): void {
    this.loading.set(true);
    this.http.get<ApiKey[]>('/api/admin/api-keys').subscribe({
      next: (data) => { this.keys.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void { this.form = this.emptyForm(); this.showModal.set(true); }
  closeModal(): void { this.showModal.set(false); }

  togglePermission(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) { this.form.permissions = [...(this.form.permissions || []), value]; }
    else { this.form.permissions = (this.form.permissions || []).filter((p) => p !== value); }
  }

  createKey(): void {
    this.saving.set(true);
    this.http.post<{ key: string }>('/api/admin/api-keys', this.form).subscribe({
      next: (res) => {
        this.newKeyValue.set(res.key);
        this.closeModal();
        this.loadKeys();
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  revokeKey(key: ApiKey): void {
    if (!confirm(`Revogar a key "${key.name}"? Esta ação não pode ser desfeita.`)) return;
    this.http.patch(`/api/admin/api-keys/${key.id}/revoke`, {}).subscribe(() => this.loadKeys());
  }

  deleteKey(key: ApiKey): void {
    if (!confirm(`Excluir permanentemente "${key.name}"?`)) return;
    this.http.delete(`/api/admin/api-keys/${key.id}`).subscribe(() => this.loadKeys());
  }

  copyKey(key: ApiKey): void {
    navigator.clipboard.writeText(key.maskedKey);
  }

  copyNewKey(): void {
    const val = this.newKeyValue();
    if (val) navigator.clipboard.writeText(val);
  }

  isExpiringSoon(key: ApiKey): boolean {
    if (!key.expiresAt) return false;
    const diff = new Date(key.expiresAt).getTime() - Date.now();
    return diff < 7 * 24 * 60 * 60 * 1000; // < 7 dias
  }

  private emptyForm(): Partial<ApiKey> & { permissions: string[] } {
    return { name: '', permissions: ['chat:read', 'chat:write'], rateLimit: 60, expiresAt: null };
  }
}
