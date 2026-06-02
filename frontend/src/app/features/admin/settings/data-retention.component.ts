import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface RetentionPolicy {
  dataType: string;
  label: string;
  description: string;
  icon: string;
  retentionDays: number | null; // null = forever
  autoDeleteEnabled: boolean;
  lastPurgeAt: string | null;
  nextPurgeAt: string | null;
  currentSizeGb: number;
  itemCount: number;
  purgeable: boolean; // permite purge manual
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

@Component({
  selector: 'app-data-retention',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="data-retention">
      <div class="page-header">
        <div>
          <h1>&#128197; Retenção e Exclusão de Dados</h1>
          <p>Configure por quanto tempo cada tipo de dado é mantido e gerencie solicitações de exclusão.</p>
        </div>
        <button class="btn-primary" (click)="saveAll()" [disabled]="saving()">
          {{ saving() ? 'Salvando...' : 'Salvar políticas' }}
        </button>
      </div>

      @if (saved()) {
        <div class="toast success">✅ Políticas salvas!</div>
      }

      <!-- Políticas por tipo de dado -->
      <div class="policies-grid">
        @for (policy of policies(); track policy.dataType) {
          <div class="policy-card">
            <div class="policy-header">
              <span class="policy-icon">{{ policy.icon }}</span>
              <div>
                <h3>{{ policy.label }}</h3>
                <p>{{ policy.description }}</p>
              </div>
            </div>

            <div class="policy-stats">
              <span>{{ policy.itemCount | number }} itens</span>
              <span>{{ policy.currentSizeGb | number:'1.1-1' }} GB</span>
            </div>

            <div class="policy-form">
              <div class="form-group">
                <label>Retenção
                  <div class="retention-input">
                    <input type="number" [(ngModel)]="policy.retentionDays"
                      [disabled]="policy.retentionDays === null"
                      min="1" max="3650" placeholder="dias" />
                    <label class="checkbox-label">
                      <input type="checkbox" [checked]="policy.retentionDays === null"
                        (change)="toggleForever(policy, $event)" />
                      Para sempre
                    </label>
                  </div>
                </label>
              </div>

              <label class="toggle-label">
                <div class="toggle-info">
                  <span>Exclusão automática</span>
                  <span class="hint">Purge automático ao atingir o prazo</span>
                </div>
                <div class="toggle-switch" [class.on]="policy.autoDeleteEnabled"
                  (click)="policy.autoDeleteEnabled = !policy.autoDeleteEnabled">
                  <div class="toggle-knob"></div>
                </div>
              </label>
            </div>

            <div class="policy-footer">
              @if (policy.lastPurgeAt) {
                <span class="hint">Último purge: {{ policy.lastPurgeAt | date:'dd/MM/yyyy' }}</span>
              }
              @if (policy.nextPurgeAt && policy.autoDeleteEnabled) {
                <span class="hint">Próximo: {{ policy.nextPurgeAt | date:'dd/MM/yyyy' }}</span>
              }
              @if (policy.purgeable) {
                <button class="btn-danger btn-sm" (click)="manualPurge(policy)"
                  [disabled]="purging() === policy.dataType">
                  {{ purging() === policy.dataType ? 'Purgando...' : '🗑️ Purge agora' }}
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Solicitações de exclusão (LGPD Art. 18) -->
      <section class="deletion-requests">
        <div class="section-header">
          <h2>&#128683; Solicitações de Exclusão (LGPD Art. 18)</h2>
          <button class="btn-secondary" (click)="newDeletionRequest()">+ Nova solicitação</button>
        </div>

        <table class="deletion-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Alvo</th>
              <th>Solicitado por</th>
              <th>Data</th>
              <th>Status</th>
              <th>Itens excluídos</th>
            </tr>
          </thead>
          <tbody>
            @for (req of deletionRequests(); track req.id) {
              <tr>
                <td><span class="type-badge">{{ req.type }}</span></td>
                <td>{{ req.targetName }}</td>
                <td>{{ req.requestedBy }}</td>
                <td>{{ req.requestedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <span class="status-pill" [class]="req.status">
                    {{ req.status === 'completed' ? '✅' : req.status === 'failed' ? '❌' : req.status === 'processing' ? '⏳' : '🕐' }}
                    {{ req.status }}
                  </span>
                </td>
                <td>{{ req.itemsDeleted !== null ? (req.itemsDeleted | number) : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: [`
    :host { display:block; font-family: Inter, system-ui, sans-serif; }
    .data-retention { padding: 28px 32px; background: #f8fafc; min-height: 100vh; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-header h1 { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-header p { font-size:13px; color:#64748b; margin:0; }
    .btn-primary { padding:8px 18px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
    .btn-primary:hover { background:#4f46e5; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-secondary { background:#f1f5f9; color:#374151; border:1px solid #e2e8f0; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-danger { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:8px 18px; cursor:pointer; font-size:13px; }
    .btn-danger.btn-sm { padding:5px 12px; font-size:12px; }
    .btn-danger:disabled { opacity:0.5; cursor:not-allowed; }
    .toast { padding:10px 16px; border-radius:8px; font-size:13px; margin-bottom:16px; }
    .toast.success { background:#dcfce7; color:#15803d; border:1px solid #86efac; }
    .policies-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; margin-bottom:24px; }
    .policy-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; display:flex; flex-direction:column; gap:14px; }
    .policy-header { display:flex; align-items:flex-start; gap:12px; }
    .policy-icon { font-size:22px; flex-shrink:0; }
    .policy-header h3 { font-size:14px; font-weight:600; color:#0f172a; margin:0 0 2px; }
    .policy-header p { font-size:12px; color:#64748b; margin:0; }
    .policy-stats { display:flex; gap:16px; font-size:12px; color:#64748b; }
    .policy-form { display:flex; flex-direction:column; gap:10px; }
    .form-group { display:flex; flex-direction:column; gap:4px; }
    .form-group label { font-size:12px; font-weight:500; color:#374151; }
    .retention-input { display:flex; align-items:center; gap:10px; margin-top:4px; }
    .retention-input input[type="number"] { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:13px; color:#1e293b; width:80px; }
    .retention-input input[type="number"]:focus { outline:none; border-color:#6366f1; }
    .checkbox-label { display:flex; align-items:center; gap:6px; font-size:12px; color:#374151; cursor:pointer; }
    .checkbox-label input[type="checkbox"] { cursor:pointer; }
    .toggle-label { display:flex; align-items:center; justify-content:space-between; cursor:pointer; }
    .toggle-info { display:flex; flex-direction:column; gap:2px; }
    .toggle-info span:first-child { font-size:13px; color:#0f172a; }
    .hint { font-size:11px; color:#94a3b8; }
    .toggle-switch { width:40px; height:22px; border-radius:11px; background:#e2e8f0; position:relative; flex-shrink:0; transition:background 0.2s; }
    .toggle-switch.on { background:#6366f1; }
    .toggle-knob { width:16px; height:16px; border-radius:50%; background:#fff; position:absolute; top:3px; left:3px; transition:left 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
    .toggle-switch.on .toggle-knob { left:21px; }
    .policy-footer { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#94a3b8; flex-wrap:wrap; gap:8px; }
    .deletion-requests { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .section-header h2 { font-size:15px; font-weight:600; color:#0f172a; margin:0; }
    .deletion-table { width:100%; border-collapse:collapse; }
    .deletion-table th { padding:10px 16px; font-size:11px; font-weight:600; text-transform:uppercase; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; }
    .deletion-table td { padding:11px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f8fafc; }
    .deletion-table tr:hover td { background:#f8fafc; }
    .type-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; background:#f1f5f9; color:#64748b; }
    .status-pill { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:500; }
    .status-pill.completed { background:#dcfce7; color:#15803d; }
    .status-pill.failed { background:#fee2e2; color:#991b1b; }
    .status-pill.processing { background:#fef3c7; color:#92400e; }
    .status-pill.pending { background:#f1f5f9; color:#64748b; }
  `]
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
    this.http.get<RetentionPolicy[]>('/api/admin/data-retention/policies').subscribe((p) => this.policies.set(p));
    this.http.get<DeletionRequest[]>('/api/admin/data-retention/deletion-requests').subscribe((r) => this.deletionRequests.set(r));
  }

  toggleForever(policy: RetentionPolicy, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    policy.retentionDays = checked ? null : 365;
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
    // Navegar para modal ou rota de nova solicitação
    const target = prompt('E-mail ou nome do usuário/projeto a ter dados excluídos:');
    if (!target) return;
    this.http.post('/api/admin/data-retention/deletion-requests', { targetName: target, type: 'user_data' })
      .subscribe(() => this.load());
  }
}
