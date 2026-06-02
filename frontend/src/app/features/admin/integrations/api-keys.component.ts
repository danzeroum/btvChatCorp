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
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .api-keys { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .btn-primary { padding:8px 18px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    .btn-primary:hover { background:#4f46e5; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-secondary { background:#f1f5f9; color:#374151; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-danger { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-ghost { background:none; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; color:#374151; }
    .btn-sm { padding:5px 12px; font-size:12px; }
    .filters-bar { margin-bottom:16px; }
    .filter-chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { padding:5px 14px; border:1px solid #e2e8f0; border-radius:20px; background:#fff; color:#374151; font-size:12px; cursor:pointer; }
    .chip.active { background:#6366f1; color:#fff; border-color:#6366f1; }
    .keys-list { display:flex; flex-direction:column; gap:12px; }
    .loading-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .empty-state { text-align:center; padding:40px; color:#94a3b8; font-size:14px; }
    .key-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; }
    .key-card.revoked { opacity:0.65; border-color:#fca5a5; }
    .key-card.expired { opacity:0.65; border-color:#fcd34d; }
    .key-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
    .key-identity { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .key-name { font-size:14px; font-weight:600; color:#0f172a; }
    .key-masked { font-family:monospace; font-size:13px; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:2px 8px; }
    .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
    .status-badge.active { background:#dcfce7; color:#15803d; }
    .status-badge.revoked { background:#fee2e2; color:#991b1b; }
    .status-badge.expired { background:#fef3c7; color:#92400e; }
    .key-actions { display:flex; gap:8px; align-items:center; }
    .key-details { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
    .key-detail { display:flex; flex-direction:column; gap:2px; }
    .key-detail .label { font-size:11px; color:#94a3b8; font-weight:500; text-transform:uppercase; letter-spacing:0.04em; }
    .key-detail span:last-child { font-size:13px; color:#374151; }
    .permission-chips { display:flex; flex-wrap:wrap; gap:4px; }
    .perm-chip { background:#eef2ff; color:#4338ca; font-size:11px; padding:2px 8px; border-radius:4px; }
    .expiring { color:#f59e0b; font-weight:600; }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; border-radius:12px; padding:24px; width:480px; max-width:90vw; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
    .modal-header h2 { font-size:16px; font-weight:600; color:#0f172a; margin:0; }
    .modal-header button { background:none; border:none; cursor:pointer; font-size:18px; color:#94a3b8; }
    .modal-body { display:flex; flex-direction:column; gap:0; }
    .modal-footer { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
    .form-group { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }
    .form-group label { font-size:12px; font-weight:500; color:#374151; }
    .form-group input { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:13px; color:#1e293b; width:100%; box-sizing:border-box; margin-top:4px; }
    .form-group input:focus { outline:none; border-color:#6366f1; }
    .perm-checkboxes { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
    .checkbox-label { display:flex; align-items:center; gap:6px; font-size:13px; color:#374151; cursor:pointer; font-weight:normal; }
    .checkbox-label input[type="checkbox"] { cursor:pointer; }
    .new-key-modal { width:540px; }
    .new-key-alert { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:8px; padding:10px 14px; font-size:13px; margin-bottom:14px; }
    .new-key-display { display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; }
    .new-key-display code { font-family:monospace; font-size:13px; color:#0f172a; flex:1; word-break:break-all; }
    .new-key-display button { padding:6px 12px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:12px; white-space:nowrap; }
  `]
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
