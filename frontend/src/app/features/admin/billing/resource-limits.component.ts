import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface ResourceLimit {
  id: string;
  type: 'workspace' | 'user' | 'project' | 'api_key';
  targetId: string;
  targetName: string;
  // Limites
  maxTokensPerDay: number | null;
  maxMessagesPerDay: number | null;
  maxDocumentsTotal: number | null;
  maxStorageGb: number | null;
  maxApiRequestsPerMin: number | null;
  // Status
  currentTokensToday: number;
  currentMessagesToday: number;
  currentDocumentsTotal: number;
  currentStorageGb: number;
  updatedAt: string;
}

@Component({
  selector: 'app-resource-limits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-limits">
      <div class="page-header">
        <div>
          <h1>&#9881;&#65039; Limites de Recursos</h1>
          <p>Configure cotas de uso por workspace, usuário, projeto ou API key.</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">+ Novo Limite</button>
      </div>

      <!-- Abas de tipo -->
      <div class="type-tabs">
        @for (tab of typeTabs; track tab.value) {
          <button [class.active]="selectedType() === tab.value" (click)="selectType(tab.value)">
            {{ tab.icon }} {{ tab.label }}
          </button>
        }
      </div>

      <!-- Lista de limites -->
      <div class="limits-list">
        @if (loading()) {
          <div class="loading-state">Carregando...</div>
        } @else if (filteredLimits().length === 0) {
          <div class="empty-state">Nenhum limite configurado para este tipo.</div>
        } @else {
          @for (limit of filteredLimits(); track limit.id) {
            <div class="limit-card" [class.exceeded]="isExceeded(limit)">
              <div class="limit-header">
                <div>
                  <h3>{{ limit.targetName }}</h3>
                  <span class="limit-type-badge">{{ limit.type }}</span>
                </div>
                <div class="limit-actions">
                  <button (click)="editLimit(limit)">Editar</button>
                  <button class="danger" (click)="deleteLimit(limit)">&#128465;&#65039;</button>
                </div>
              </div>

              <div class="limit-metrics">
                @if (limit.maxTokensPerDay !== null) {
                  <div class="limit-metric">
                    <span class="metric-label">Tokens/dia</span>
                    <div class="usage-bar">
                      <div class="usage-fill" [style.width.%]="usagePercent(limit.currentTokensToday, limit.maxTokensPerDay)"
                        [class.warn]="usagePercent(limit.currentTokensToday, limit.maxTokensPerDay) > 80"
                        [class.critical]="usagePercent(limit.currentTokensToday, limit.maxTokensPerDay) > 95">
                      </div>
                    </div>
                    <span class="usage-text">{{ shortNumber(limit.currentTokensToday) }} / {{ shortNumber(limit.maxTokensPerDay) }}</span>
                  </div>
                }
                @if (limit.maxMessagesPerDay !== null) {
                  <div class="limit-metric">
                    <span class="metric-label">Mensagens/dia</span>
                    <div class="usage-bar">
                      <div class="usage-fill" [style.width.%]="usagePercent(limit.currentMessagesToday, limit.maxMessagesPerDay)"></div>
                    </div>
                    <span class="usage-text">{{ limit.currentMessagesToday }} / {{ limit.maxMessagesPerDay }}</span>
                  </div>
                }
                @if (limit.maxStorageGb !== null) {
                  <div class="limit-metric">
                    <span class="metric-label">Storage</span>
                    <div class="usage-bar">
                      <div class="usage-fill" [style.width.%]="usagePercent(limit.currentStorageGb, limit.maxStorageGb)"></div>
                    </div>
                    <span class="usage-text">{{ limit.currentStorageGb | number:'1.1-1' }}GB / {{ limit.maxStorageGb }}GB</span>
                  </div>
                }
              </div>

              <div class="limit-footer">
                <span>Atualizado {{ limit.updatedAt | date:'dd/MM HH:mm' }}</span>
                @if (isExceeded(limit)) {
                  <span class="exceeded-badge">&#9888;&#65039; Limite excedido</span>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingLimit() ? 'Editar' : 'Novo' }} Limite de Recurso</h2>
            <button (click)="closeModal()">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Tipo de alvo
                <select [(ngModel)]="form.type">
                  <option value="workspace">Workspace inteiro</option>
                  <option value="user">Usuário específico</option>
                  <option value="project">Projeto específico</option>
                  <option value="api_key">API Key</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>Nome/ID do alvo
                <input [(ngModel)]="form.targetName" placeholder="Nome do usuário, projeto ou API key" />
              </label>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Máx. tokens/dia (null = ilimitado)
                  <input type="number" [(ngModel)]="form.maxTokensPerDay" placeholder="ex: 100000" />
                </label>
              </div>
              <div class="form-group">
                <label>Máx. mensagens/dia
                  <input type="number" [(ngModel)]="form.maxMessagesPerDay" placeholder="ex: 500" />
                </label>
              </div>
              <div class="form-group">
                <label>Máx. documentos total
                  <input type="number" [(ngModel)]="form.maxDocumentsTotal" placeholder="ex: 1000" />
                </label>
              </div>
              <div class="form-group">
                <label>Máx. storage (GB)
                  <input type="number" [(ngModel)]="form.maxStorageGb" placeholder="ex: 50" />
                </label>
              </div>
              <div class="form-group">
                <label>Máx. requests API/min
                  <input type="number" [(ngModel)]="form.maxApiRequestsPerMin" placeholder="ex: 60" />
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ResourceLimitsComponent implements OnInit {
  private http = inject(HttpClient);

  loading      = signal(false);
  saving       = signal(false);
  showModal    = signal(false);
  editingLimit = signal<ResourceLimit | null>(null);
  limits       = signal<ResourceLimit[]>([]);
  selectedType = signal<ResourceLimit['type']>('workspace');

  form: Partial<ResourceLimit> = this.emptyForm();

  typeTabs = [
    { value: 'workspace', label: 'Workspace',  icon: '🏢' },
    { value: 'user',      label: 'Usuários',   icon: '👤' },
    { value: 'project',   label: 'Projetos',   icon: '📁' },
    { value: 'api_key',   label: 'API Keys',   icon: '🔑' },
  ];

  filteredLimits() {
    return this.limits().filter((l) => l.type === this.selectedType());
  }

  ngOnInit(): void { this.loadLimits(); }

  loadLimits(): void {
    this.loading.set(true);
    this.http.get<ResourceLimit[]>('/api/admin/resource-limits').subscribe({
      next: (data) => { this.limits.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  selectType(type: ResourceLimit['type']): void { this.selectedType.set(type); }

  openCreate(): void {
    this.editingLimit.set(null);
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  editLimit(limit: ResourceLimit): void {
    this.editingLimit.set(limit);
    this.form = { ...limit };
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); this.editingLimit.set(null); }

  save(): void {
    this.saving.set(true);
    const editing = this.editingLimit();
    const req$ = editing
      ? this.http.put(`/api/admin/resource-limits/${editing.id}`, this.form)
      : this.http.post('/api/admin/resource-limits', this.form);
    req$.subscribe({ next: () => { this.loadLimits(); this.closeModal(); this.saving.set(false); }, error: () => this.saving.set(false) });
  }

  deleteLimit(limit: ResourceLimit): void {
    if (!confirm(`Remover limite de "${limit.targetName}"?`)) return;
    this.http.delete(`/api/admin/resource-limits/${limit.id}`).subscribe(() => this.loadLimits());
  }

  usagePercent(current: number, max: number | null): number {
    if (!max) return 0;
    return Math.min((current / max) * 100, 100);
  }

  isExceeded(limit: ResourceLimit): boolean {
    if (limit.maxTokensPerDay   && limit.currentTokensToday   >= limit.maxTokensPerDay)   return true;
    if (limit.maxMessagesPerDay && limit.currentMessagesToday >= limit.maxMessagesPerDay) return true;
    if (limit.maxStorageGb      && limit.currentStorageGb     >= limit.maxStorageGb)      return true;
    return false;
  }

  shortNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  private emptyForm(): Partial<ResourceLimit> {
    return { type: 'workspace', targetName: '', maxTokensPerDay: null, maxMessagesPerDay: null, maxDocumentsTotal: null, maxStorageGb: null, maxApiRequestsPerMin: null };
  }
}
