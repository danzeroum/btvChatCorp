import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToggleComponent } from '../shared/toggle.component';
import { StatusPillComponent } from '../shared/status-pill.component';

interface RetentionPolicy {
  dataType: string;
  label: string;
  description: string;
  icon: string;
  retentionDays: number | null;
  autoDeleteEnabled: boolean;
  lastPurgeAt: string | null;
  nextPurgeAt: string | null;
  currentSizeGb: number;
  itemCount: number;
  purgeable: boolean;
  locked?: boolean;
}

interface DeletionRequest {
  id: string;
  type: 'user_data' | 'project_data' | 'all_data';
  requestedBy: string;
  targetName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  itemsDeleted: number | null;
}

// Dados fabricados de políticas/solicitações removidos: na falha do fetch a UI
// mostra lista vazia (estado honesto) em vez de itens falsos.

@Component({
  selector: 'app-data-retention',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, ToggleComponent, StatusPillComponent],
  template: `
    <div class="admin-page">
      <div class="breadcrumb">
        <a [routerLink]="['/admin/dashboard']" class="bc-link">Dashboard</a>
        <span class="bc-sep">/</span>
        <span>Retenção de Dados</span>
      </div>

      <div class="admin-header">
        <div>
          <h1>Retenção e Exclusão de Dados</h1>
          <p class="page-sub">Configure por quanto tempo cada tipo de dado é mantido</p>
        </div>
        <button class="btn-primary" (click)="saveAll()" [disabled]="saving()">
          {{ saving() ? 'Salvando…' : 'Salvar políticas' }}
        </button>
      </div>

      @if (saved()) {
        <div class="toast-bar">Políticas salvas com sucesso.</div>
      }

      <div class="policies-grid">
        @for (policy of policies(); track policy.dataType) {
          <div class="policy-card" [class.card-locked]="policy.locked">
            <div class="card-head">
              <span class="card-icon">{{ policy.icon }}</span>
              <div>
                <span class="card-title">{{ policy.label }}</span>
                @if (policy.locked) { <span class="locked-badge">Bloqueado — 365d mínimo</span> }
                <p class="card-desc">{{ policy.description }}</p>
              </div>
            </div>
            <div class="card-stats">
              <span class="stat-item mono">{{ policy.itemCount | number }} itens</span>
              <span class="stat-item mono">{{ policy.currentSizeGb | number:'1.1-1' }} GB</span>
            </div>

            <div class="card-form">
              <div class="retention-field">
                <span class="field-label">Retenção</span>
                @if (policy.locked) {
                  <span class="mono locked-val">365 dias (mínimo LGPD)</span>
                } @else if (policy.retentionDays === null) {
                  <span class="mono">Para sempre</span>
                } @else {
                  <div class="days-row">
                    <input type="number" class="days-input mono" [(ngModel)]="policy.retentionDays"
                           [disabled]="policy.locked ?? false" min="1" max="3650"
                           (change)="confirmReduceIfNeeded(policy)" />
                    <span class="days-unit">dias</span>
                  </div>
                }
                @if (!policy.locked) {
                  <label class="forever-check">
                    <input type="checkbox" [checked]="policy.retentionDays === null"
                           (change)="toggleForever(policy, $event)" />
                    Para sempre
                  </label>
                }
              </div>

              @if (!policy.locked) {
                <div class="toggle-row">
                  <div>
                    <span class="toggle-title">Exclusão automática</span>
                    <span class="toggle-hint">Purge automático ao atingir o prazo</span>
                  </div>
                  <app-toggle [(ngModel)]="policy.autoDeleteEnabled" />
                </div>
              }
            </div>

            <div class="card-foot">
              @if (policy.lastPurgeAt) {
                <span class="foot-hint">Último purge: <span class="mono">{{ policy.lastPurgeAt | date:'dd/MM/yyyy' }}</span></span>
              }
              @if (policy.nextPurgeAt && policy.autoDeleteEnabled) {
                <span class="foot-hint">Próximo: <span class="mono">{{ policy.nextPurgeAt | date:'dd/MM/yyyy' }}</span></span>
              }
              @if (policy.purgeable && !policy.locked) {
                <button class="btn-purge" (click)="manualPurge(policy)" [disabled]="purging() === policy.dataType">
                  {{ purging() === policy.dataType ? 'Purgando…' : 'Purge manual' }}
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- LGPD Art. 18 deletion requests -->
      <div class="section-card">
        <div class="section-head">
          <h2>Solicitações de Exclusão — LGPD Art. 18</h2>
          <button class="btn-ghost" (click)="newDeletionRequest()">+ Nova solicitação</button>
        </div>

        <div class="dr-grid">
          <div class="dr-head">
            <span>Tipo</span>
            <span>Alvo</span>
            <span>Solicitado por</span>
            <span>Data</span>
            <span>Status</span>
            <span class="align-right">Itens</span>
          </div>
          @for (req of deletionRequests(); track req.id) {
            <div class="dr-row">
              <span><span class="type-tag">{{ req.type }}</span></span>
              <span>{{ req.targetName }}</span>
              <span class="ink-3">{{ req.requestedBy }}</span>
              <span class="mono ink-3">{{ req.requestedAt | date:'dd/MM/yyyy HH:mm' }}</span>
              <span>
                <app-status-pill [kind]="drKind(req.status)">{{ drLabel(req.status) }}</app-status-pill>
              </span>
              <span class="align-right mono ink-3">{{ req.itemsDeleted !== null ? (req.itemsDeleted | number) : '—' }}</span>
            </div>
          }
        </div>
      </div>
    </div>
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
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .btn-ghost { background:none; border:1px solid var(--line); border-radius:8px; padding:7px 14px; font-size:13px; color:var(--ink-2); cursor:pointer; }
    .btn-ghost:hover { background:var(--panel-2); }
    .btn-purge { padding:5px 12px; border-radius:6px; border:1px solid var(--acc-line); background:var(--acc-soft); color:var(--acc); font-size:12px; cursor:pointer; }
    .btn-purge:disabled { opacity:.5; cursor:not-allowed; }
    .toast-bar { background:var(--good-soft); color:var(--good); border:1px solid #b2d8c4; border-radius:8px; padding:10px 16px; font-size:13px; margin-bottom:16px; }
    .policies-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; margin-bottom:16px; }
    .policy-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:18px 20px; display:flex; flex-direction:column; gap:12px; }
    .card-locked { border-color:var(--line-2); opacity:.85; }
    .card-head { display:flex; gap:10px; align-items:flex-start; }
    .card-icon { font-size:20px; flex-shrink:0; }
    .card-title { font-size:13px; font-weight:600; color:var(--ink); display:block; }
    .locked-badge { display:inline-block; font-size:10.5px; background:var(--line-2); color:var(--ink-3); border-radius:4px; padding:1px 6px; margin-left:6px; }
    .card-desc { font-size:12px; color:var(--ink-3); margin:2px 0 0; }
    .card-stats { display:flex; gap:14px; }
    .stat-item { font-size:12px; color:var(--ink-3); }
    .card-form { display:flex; flex-direction:column; gap:10px; }
    .retention-field { display:flex; flex-direction:column; gap:6px; }
    .field-label { font-size:12px; font-weight:500; color:var(--ink-2); }
    .days-row { display:flex; align-items:center; gap:6px; }
    .days-input { width:64px; border:1px solid var(--line); border-radius:6px; padding:5px 8px; font-size:13px; color:var(--ink); background:var(--white); }
    .days-input:focus { outline:none; border-color:var(--acc); }
    .days-unit { font-size:12px; color:var(--ink-3); }
    .forever-check { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-2); cursor:pointer; }
    .forever-check input { accent-color:var(--acc); }
    .locked-val { font-size:13px; color:var(--ink-3); }
    .toggle-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:8px; border-top:1px solid var(--line-2); }
    .toggle-title { font-size:13px; font-weight:500; color:var(--ink); display:block; }
    .toggle-hint { font-size:11.5px; color:var(--ink-3); }
    .card-foot { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; min-height:28px; }
    .foot-hint { font-size:11.5px; color:var(--ink-3); }
    .section-card { background:var(--white); border:1px solid var(--line); border-radius:10px; padding:20px 24px; margin-bottom:12px; }
    .section-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .section-head h2 { font-size:14px; font-weight:600; color:var(--ink); margin:0; }
    .dr-grid { display:grid; grid-template-columns: 120px 1fr 1fr 130px 110px 80px; gap:0; }
    .dr-head { display:contents; }
    .dr-head > span { padding:9px 10px; font-size:11px; font-weight:600; color:var(--ink-3); border-bottom:1px solid var(--line); background:var(--panel-2); }
    .dr-row { display:contents; }
    .dr-row > span { padding:10px 10px; font-size:12.5px; color:var(--ink); border-bottom:1px solid var(--line-2); display:flex; align-items:center; }
    .dr-row:last-child > span { border-bottom:none; }
    .dr-row:hover > span { background:var(--panel-2); }
    .type-tag { font-size:11px; background:var(--panel-2); border:1px solid var(--line); color:var(--ink-2); border-radius:4px; padding:2px 7px; font-family:'IBM Plex Mono', monospace; }
    .align-right { justify-content:flex-end !important; }
    .mono { font-family:'IBM Plex Mono', monospace; }
    .ink-3 { color:var(--ink-3); }
  `],
})
export class DataRetentionComponent implements OnInit {
  private http = inject(HttpClient);

  saving           = signal(false);
  saved            = signal(false);
  purging          = signal<string | null>(null);
  policies         = signal<RetentionPolicy[]>([]);
  deletionRequests = signal<DeletionRequest[]>([]);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<RetentionPolicy[]>('/api/admin/data-retention/policies').subscribe({
      next: (p) => this.policies.set(p),
      error: () => this.policies.set([]),
    });
    this.http.get<DeletionRequest[]>('/api/admin/data-retention/deletion-requests').subscribe({
      next: (r) => this.deletionRequests.set(r),
      error: () => this.deletionRequests.set([]),
    });
  }

  toggleForever(policy: RetentionPolicy, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.policies.update((list) =>
      list.map((p) => p.dataType === policy.dataType ? { ...p, retentionDays: checked ? null : 365 } : p)
    );
  }

  confirmReduceIfNeeded(policy: RetentionPolicy): void {
    if ((policy.retentionDays ?? 0) < 365 && policy.dataType === 'audit_logs') {
      alert('Logs de auditoria devem ser mantidos por no mínimo 365 dias (LGPD).');
      this.policies.update((list) =>
        list.map((p) => p.dataType === policy.dataType ? { ...p, retentionDays: 365 } : p)
      );
    }
  }

  saveAll(): void {
    this.saving.set(true);
    this.http.put('/api/admin/data-retention/policies', this.policies()).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 3000); },
      error: () => this.saving.set(false),
    });
  }

  manualPurge(policy: RetentionPolicy): void {
    if (!confirm(`Purge manual de "${policy.label}"? Dados mais antigos que ${policy.retentionDays} dias serão excluídos permanentemente.`)) return;
    this.purging.set(policy.dataType);
    this.http.post(`/api/admin/data-retention/purge/${policy.dataType}`, {}).subscribe({
      next: () => { this.purging.set(null); this.load(); },
      error: () => this.purging.set(null),
    });
  }

  newDeletionRequest(): void {
    const target = prompt('E-mail ou nome do usuário/projeto para excluir dados:');
    if (!target?.trim()) return;
    this.http.post('/api/admin/data-retention/deletion-requests', { targetName: target.trim(), type: 'user_data' })
      .subscribe(() => this.load());
  }

  drKind(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
    return status === 'completed' ? 'ok' : status === 'failed' ? 'bad' : status === 'processing' ? 'warn' : 'neutral';
  }

  drLabel(status: string): string {
    return { pending: 'Pendente', processing: 'Processando', completed: 'Concluído', failed: 'Falhou' }[status] ?? status;
  }
}
