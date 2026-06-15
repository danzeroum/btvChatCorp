import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, ApiKeyAdmin } from '../admin.service';
import { StatusPillComponent } from '../shared/status-pill.component';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, StatusPillComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Chaves de API</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Chaves de API</h1>
          <p class="page-sub">Gerencie integrações com sistemas externos via REST API</p>
        </div>
        <button class="btn-primary" (click)="showCreate.set(true)">+ Nova chave</button>
      </div>

      @if (newKeyValue()) {
        <div class="secret-banner">
          <div class="secret-icon">🔑</div>
          <div class="secret-body">
            <span class="secret-label">Copie agora — não será mostrada novamente</span>
            <code class="secret-code mono">{{ newKeyValue() }}</code>
          </div>
          <button class="secret-copy" (click)="copyKey(newKeyValue()!)">Copiar</button>
          <button class="secret-close" (click)="newKeyValue.set(null)">×</button>
        </div>
      }

      <!-- Keys table -->
      <div class="section-card">
        @if (loading()) {
          <div class="loading-hint">Carregando chaves…</div>
        } @else if (apiKeys().length === 0) {
          <div class="empty-hint">Nenhuma chave criada ainda.</div>
        } @else {
          <div class="keys-grid">
            <div class="keys-head">
              <span>Nome</span>
              <span class="mono">Prefixo</span>
              <span>Permissões</span>
              <span class="align-right">Rate limit</span>
              <span>Último uso</span>
              <span>Ações</span>
            </div>
            @for (key of apiKeys(); track key.id) {
              <div class="keys-row" [class.row-revoked]="key.status !== 'active'">
                <span class="key-name">{{ key.name }}</span>
                <span class="mono ink-3">{{ key.prefix }}…</span>
                <span class="perms-cell">
                  @for (p of (key.permissions ?? []); track p) {
                    <span class="perm-tag">{{ p }}</span>
                  }
                </span>
                <span class="align-right mono">{{ key.rateLimit }} rpm</span>
                <span class="mono ink-3">{{ key.lastUsedAt ? (key.lastUsedAt | date:'dd/MM/yyyy') : 'nunca' }}</span>
                <span class="actions-cell">
                  @if (key.status === 'active') {
                    <button class="btn-sm btn-ghost-acc" (click)="revoke(key)">Revogar</button>
                  } @else {
                    <app-status-pill kind="neutral">Revogada</app-status-pill>
                  }
                </span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Swagger link -->
      <div class="swagger-card">
        <div>
          <span class="swagger-title">Documentação da API</span>
          <p class="swagger-sub">Integre com ERP, n8n, Zapier ou qualquer sistema externo.</p>
        </div>
        <a [href]="swaggerUrl" target="_blank" class="btn-ghost">Abrir Swagger UI</a>
      </div>
    </div>

    <!-- Create modal -->
    @if (showCreate()) {
      <div class="modal-scrim" (click)="showCreate.set(false)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2>Nova chave de API</h2>
            <button class="modal-close" (click)="showCreate.set(false)">×</button>
          </div>
          <div class="modal-body">
            <label class="form-label">Nome
              <input [(ngModel)]="newKey.name" class="form-input" placeholder="ERP Integration" />
            </label>
            <label class="form-label">Rate limit (req/min)
              <input type="number" [(ngModel)]="newKey.rateLimit" class="form-input" min="1" max="1000" />
            </label>
            <span class="form-label">Permissões</span>
            <div class="perms-grid">
              @for (r of resources; track r) {
                <label class="perm-check">
                  <input type="checkbox" [checked]="hasPermission(r)" (change)="togglePermission(r)" />
                  {{ r }}
                </label>
              }
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn-ghost" (click)="showCreate.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="createKey()" [disabled]="!newKey.name">Criar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .admin-page { padding: 28px 32px; font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 1100px; }
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
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 16px; font-size:13px; color:var(--ink-2); cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
    .btn-ghost:hover { background:var(--panel-2); }
    .btn-sm { padding:5px 12px; border-radius:6px; font-size:12px; cursor:pointer; }
    .btn-ghost-acc { background:none; border:1px solid var(--acc-line); color:var(--acc); border-radius:6px; padding:4px 12px; font-size:12px; cursor:pointer; }
    .btn-ghost-acc:hover { background:var(--acc-soft); }
    .secret-banner { display:flex; align-items:center; gap:14px; background:var(--good-soft); border:1px solid #b2d8c4; border-radius:10px; padding:14px 18px; margin-bottom:16px; }
    .secret-icon { font-size:20px; flex-shrink:0; }
    .secret-body { flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; }
    .secret-label { font-size:12px; font-weight:600; color:var(--good); }
    .secret-code { font-size:12px; color:var(--ink); word-break:break-all; }
    .secret-copy { padding:5px 14px; background:var(--good); color:var(--white); border:none; border-radius:6px; font-size:12px; cursor:pointer; flex-shrink:0; }
    .secret-close { background:none; border:none; font-size:18px; color:var(--ink-3); cursor:pointer; line-height:1; padding:0 4px; }
    .section-card { background:var(--white); border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:12px; }
    .loading-hint, .empty-hint { padding:40px; text-align:center; font-size:13px; color:var(--ink-3); }
    .keys-grid { display:grid; grid-template-columns: 1.4fr 100px 1fr 80px 110px 100px; }
    .keys-head { display:contents; }
    .keys-head > span { padding:10px 14px; font-size:11px; font-weight:600; color:var(--ink-3); background:var(--panel-2); border-bottom:1px solid var(--line); }
    .keys-row { display:contents; }
    .keys-row > span { padding:10px 14px; font-size:13px; color:var(--ink); border-bottom:1px solid var(--line-2); display:flex; align-items:center; }
    .keys-row:last-child > span { border-bottom:none; }
    .keys-row:hover > span { background:var(--panel-2); }
    .row-revoked > span { opacity:.55; }
    .key-name { font-weight:500; }
    .perms-cell { display:flex; flex-wrap:wrap; gap:4px; padding-top:6px !important; padding-bottom:6px !important; }
    .perm-tag { background:var(--panel-2); color:var(--ink-2); font-size:10.5px; padding:2px 7px; border-radius:4px; border:1px solid var(--line); }
    .actions-cell { justify-content:flex-start !important; }
    .align-right { justify-content:flex-end !important; }
    .swagger-card { display:flex; align-items:center; justify-content:space-between; background:var(--white); border:1px solid var(--line); border-radius:10px; padding:18px 24px; gap:16px; }
    .swagger-title { font-size:14px; font-weight:600; color:var(--ink); display:block; margin-bottom:4px; }
    .swagger-sub { font-size:12px; color:var(--ink-3); margin:0; }
    .mono { font-family:'IBM Plex Mono', monospace; }
    .ink-3 { color:var(--ink-3); }
    .modal-scrim { position:fixed; inset:0; background:rgba(28,27,25,.28); display:flex; align-items:center; justify-content:center; z-index:100; animation:fadeIn .16s; }
    .modal-card { background:var(--white); border-radius:12px; padding:0; width:480px; max-width:90vw; overflow:hidden; animation:slideIn .16s ease-out; }
    .modal-head { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid var(--line); }
    .modal-head h2 { font-size:16px; font-weight:600; color:var(--ink); margin:0; }
    .modal-close { background:none; border:none; font-size:20px; color:var(--ink-3); cursor:pointer; line-height:1; }
    .modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:14px; }
    .modal-foot { display:flex; gap:10px; justify-content:flex-end; padding:16px 24px; border-top:1px solid var(--line); }
    .form-label { font-size:12px; font-weight:500; color:var(--ink-2); display:flex; flex-direction:column; gap:5px; }
    .form-input { background:var(--white); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:13px; color:var(--ink); width:100%; box-sizing:border-box; }
    .form-input:focus { outline:none; border-color:var(--acc); }
    .perms-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:4px; }
    .perm-check { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink); cursor:pointer; }
    @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes slideIn { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }
  `],
})
export class ApiKeysComponent implements OnInit {
  private adminSvc = inject(AdminService);

  apiKeys     = signal<ApiKeyAdmin[]>([]);
  loading     = signal(true);
  showCreate  = signal(false);
  newKeyValue = signal<string | null>(null);
  swaggerUrl  = `${window.location.origin}/api-docs`;
  resources   = ['chat', 'documents', 'search', 'training', 'webhooks', 'usage'];
  newKey      = { name: '', rateLimit: 60, selectedResources: ['chat', 'search'] };

  ngOnInit(): void { this.loadKeys(); }

  loadKeys(): void {
    this.loading.set(true);
    this.adminSvc.listApiKeys().subscribe({
      next: (k) => { this.apiKeys.set(k); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  hasPermission(r: string): boolean { return this.newKey.selectedResources.includes(r); }

  togglePermission(r: string): void {
    const sr = this.newKey.selectedResources;
    const idx = sr.indexOf(r);
    idx === -1 ? sr.push(r) : sr.splice(idx, 1);
  }

  createKey(): void {
    this.adminSvc.createApiKey({
      name: this.newKey.name,
      rateLimit: this.newKey.rateLimit,
      permissions: this.newKey.selectedResources,
    }).subscribe(({ key }) => {
      this.newKeyValue.set(key);
      this.showCreate.set(false);
      this.newKey = { name: '', rateLimit: 60, selectedResources: ['chat', 'search'] };
      this.loadKeys();
    });
  }

  revoke(key: ApiKeyAdmin): void {
    if (!confirm(`Revogar a chave "${key.name}"? Esta ação não pode ser desfeita.`)) return;
    this.adminSvc.revokeApiKey(key.id).subscribe(() => {
      this.apiKeys.update((keys) => keys.map((k) => k.id === key.id ? { ...k, status: 'revoked' as const } : k));
    });
  }

  copyKey(value: string): void { navigator.clipboard.writeText(value); }
}
