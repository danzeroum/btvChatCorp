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
  `
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
