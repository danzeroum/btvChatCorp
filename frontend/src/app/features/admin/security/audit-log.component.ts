import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuditLogEntry, AuditFilters, AuditAction, AuditCategory, AuditSeverity } from '../../../core/models/admin.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-log">
      <div class="page-header">
        <div>
          <h1>&#128196; Logs de Auditoria</h1>
          <p>Registro completo de todas as ações no workspace. Retenção: <strong>{{ retentionDays }} dias</strong>.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="generateComplianceReport()">&#128196; Relatório LGPD</button>
          <button class="btn-secondary" (click)="exportLogs()">&#11015;&#65039; Exportar CSV</button>
        </div>
      </div>

      <!-- Filtros avançados -->
      <div class="audit-filters">
        <div class="filter-row">
          <div class="filter-group">
            <label>Período</label>
            <div class="date-range">
              <input type="date" [(ngModel)]="filters.dateFrom" (ngModelChange)="applyFilters()" />
              <span>até</span>
              <input type="date" [(ngModel)]="filters.dateTo" (ngModelChange)="applyFilters()" />
            </div>
          </div>

          <div class="filter-group">
            <label>Categoria</label>
            <select [(ngModel)]="filters.category" (ngModelChange)="applyFilters()">
              <option value="">Todas</option>
              <option value="authentication">&#128274; Autenticação</option>
              <option value="user_management">&#128100; Gestão de Usuários</option>
              <option value="data_access">&#128196; Acesso a Dados</option>
              <option value="ai_operations">&#129302; Operações AI</option>
              <option value="system_config">&#9881;&#65039; Configuração</option>
              <option value="security_event">&#9888;&#65039; Eventos de Segurança</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Severidade</label>
            <div class="severity-chips">
              @for (sev of severities; track sev.value) {
                <button class="chip" [class.active]="filters.severity.includes(sev.value)"
                  (click)="toggleSeverity(sev.value)">
                  {{ sev.icon }} {{ sev.label }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <label>Usuário</label>
            <select [(ngModel)]="filters.userId" (ngModelChange)="applyFilters()">
              <option value="">Todos</option>
              @for (u of users(); track u.id) {
                <option [value]="u.id">{{ u.name }}</option>
              }
            </select>
          </div>

          <div class="filter-group">
            <label>Busca</label>
            <input type="text" placeholder="Buscar em detalhes, IP, recurso..."
              [(ngModel)]="filters.search" (input)="applyFiltersDebounced()" />
          </div>
        </div>

        <div class="filter-summary">
          <span>{{ totalEntries() }} eventos encontrados</span>
          @if (hasActiveFilters()) {
            <button class="btn-text" (click)="clearFilters()">&#10006; Limpar filtros</button>
          }
        </div>
      </div>

      <!-- Timeline de eventos -->
      <div class="audit-timeline">
        @if (loading()) {
          <div class="loading-state">Carregando eventos...</div>
        } @else if (auditEntries().length === 0) {
          <div class="empty-state">Nenhum evento encontrado para os filtros selecionados.</div>
        } @else {
          @for (entry of auditEntries(); track entry.id) {
            <div class="audit-entry" [class]="entry.severity" (click)="showDetail(entry)">
              <!-- Indicador de severidade -->
              <div class="entry-severity">
                <span class="severity-dot"></span>
                <span class="entry-time">{{ entry.timestamp | date:'HH:mm:ss' }}</span>
              </div>

              <!-- Conteúdo -->
              <div class="entry-content">
                <div class="entry-header">
                  <span class="entry-user">
                    <span class="avatar-xs">{{ entry.userName.slice(0, 2) }}</span>
                    {{ entry.userName }}
                  </span>
                  <span class="entry-action">{{ getActionLabel(entry.action) }}</span>
                  <span class="entry-resource">{{ entry.resourceName }}</span>
                  <span class="entry-category-badge">{{ getCategoryIcon(entry.category) }} {{ entry.category }}</span>
                </div>

                @if (entry.details && objectKeys(entry.details).length > 0) {
                  <div class="entry-details">{{ formatDetails(entry) }}</div>
                }

                <div class="entry-meta">
                  <span class="meta-item">&#127760; {{ entry.userIp }}</span>
                  <span class="meta-item">{{ entry.timestamp | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>

      <!-- Paginação -->
      <div class="pagination">
        <button [disabled]="page() === 1" (click)="loadPage(page() - 1)">&#8592; Anterior</button>
        <span>Página {{ page() }} de {{ totalPages() }}</span>
        <button [disabled]="page() === totalPages()" (click)="loadPage(page() + 1)">Próxima &#8594;</button>
      </div>
    </div>

    <!-- Modal de detalhe -->
    @if (selectedEntry()) {
      <div class="modal-overlay" (click)="selectedEntry.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Detalhe do Evento</h2>
            <button (click)="selectedEntry.set(null)">&#10005;</button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-row"><span>ID</span><code>{{ selectedEntry()!.id }}</code></div>
              <div class="detail-row"><span>Timestamp</span><span>{{ selectedEntry()!.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</span></div>
              <div class="detail-row"><span>Usuário</span><span>{{ selectedEntry()!.userName }} ({{ selectedEntry()!.userId }})</span></div>
              <div class="detail-row"><span>IP</span><code>{{ selectedEntry()!.userIp }}</code></div>
              <div class="detail-row"><span>Ação</span><span>{{ getActionLabel(selectedEntry()!.action) }}</span></div>
              <div class="detail-row"><span>Recurso</span><span>{{ selectedEntry()!.resourceName }} ({{ selectedEntry()!.resourceId }})</span></div>
              <div class="detail-row"><span>Categoria</span><span>{{ selectedEntry()!.category }}</span></div>
              <div class="detail-row"><span>Severidade</span><span class="severity-badge" [class]="selectedEntry()!.severity">{{ selectedEntry()!.severity }}</span></div>
            </div>

            @if (selectedEntry()!.previousValue || selectedEntry()!.newValue) {
              <div class="diff-section">
                <h4>Mudança</h4>
                <div class="diff-grid">
                  @if (selectedEntry()!.previousValue) {
                    <div class="diff-before">
                      <span>Antes</span>
                      <pre>{{ selectedEntry()!.previousValue | json }}</pre>
                    </div>
                  }
                  @if (selectedEntry()!.newValue) {
                    <div class="diff-after">
                      <span>Depois</span>
                      <pre>{{ selectedEntry()!.newValue | json }}</pre>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="details-section">
              <h4>Detalhes</h4>
              <pre class="json-viewer">{{ selectedEntry()!.details | json }}</pre>
            </div>

            <div class="ua-section">
              <span class="meta-item">&#128084; {{ selectedEntry()!.userAgent }}</span>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class AuditLogComponent implements OnInit {
  private http   = inject(HttpClient);
  private router = inject(Router);

  loading       = signal(false);
  auditEntries  = signal<AuditLogEntry[]>([]);
  users         = signal<{ id: string; name: string }[]>([]);
  selectedEntry = signal<AuditLogEntry | null>(null);
  totalEntries  = signal(0);
  page          = signal(1);
  perPage       = 50;
  retentionDays = 365;

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalEntries() / this.perPage)));

  filters: AuditFilters = this.defaultFilters();

  severities: { value: AuditSeverity; label: string; icon: string }[] = [
    { value: 'info',     label: 'Info',    icon: 'ℹ️' },
    { value: 'warning',  label: 'Warning', icon: '⚠️' },
    { value: 'critical', label: 'Crítico', icon: '🔴' },
  ];

  private debounceTimer: any;

  ngOnInit(): void {
    this.loadUsers();
    this.applyFilters();
  }

  loadUsers(): void {
    this.http.get<{ id: string; name: string }[]>('/api/admin/users?minimal=true')
      .subscribe((u) => this.users.set(u));
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadLogs();
  }

  applyFiltersDebounced(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.applyFilters(), 400);
  }

  loadPage(p: number): void {
    this.page.set(p);
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.page())
      .set('perPage', this.perPage);

    if (this.filters.dateFrom) params = params.set('from', this.filters.dateFrom);
    if (this.filters.dateTo)   params = params.set('to',   this.filters.dateTo);
    if (this.filters.category) params = params.set('category', this.filters.category);
    if (this.filters.userId)   params = params.set('userId',   this.filters.userId);
    if (this.filters.search)   params = params.set('search',   this.filters.search);
    if (this.filters.severity.length) params = params.set('severity', this.filters.severity.join(','));

    this.http.get<{ items: AuditLogEntry[]; total: number }>('/api/admin/audit', { params }).subscribe({
      next: (res) => {
        this.auditEntries.set(res.items);
        this.totalEntries.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleSeverity(sev: AuditSeverity): void {
    if (this.filters.severity.includes(sev)) {
      this.filters.severity = this.filters.severity.filter((s) => s !== sev);
    } else {
      this.filters.severity = [...this.filters.severity, sev];
    }
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return !!this.filters.category || !!this.filters.userId || !!this.filters.search ||
      !!this.filters.dateFrom || this.filters.severity.length > 0;
  }

  clearFilters(): void {
    this.filters = this.defaultFilters();
    this.applyFilters();
  }

  showDetail(entry: AuditLogEntry): void { this.selectedEntry.set(entry); }

  exportLogs(): void {
    const params = new URLSearchParams();
    if (this.filters.dateFrom) params.set('from', this.filters.dateFrom);
    if (this.filters.dateTo)   params.set('to',   this.filters.dateTo);
    if (this.filters.category) params.set('category', this.filters.category);
    window.open(`/api/admin/audit/export?${params}`, '_blank');
  }

  generateComplianceReport(): void {
    this.router.navigate(['/admin/security/compliance']);
  }

  getActionLabel(action: AuditAction): string {
    const map: Partial<Record<AuditAction, string>> = {
      login: 'Fez login', logout: 'Fez logout', login_failed: 'Falha de login',
      user_created: 'Criou usuário', user_suspended: 'Suspendeu usuário',
      document_uploaded: 'Enviou documento', document_deleted: 'Excluiu documento',
      chat_created: 'Iniciou conversa', settings_changed: 'Alterou configurações',
      api_key_created: 'Criou API key', api_key_revoked: 'Revogou API key',
      pii_detected: 'PII detectado', access_denied: 'Acesso negado',
      training_started: 'Iniciou treinamento', training_deployed: 'Deployou modelo',
      lora_deployed: 'Deployou LoRA',
    };
    return map[action] ?? action.replace(/_/g, ' ');
  }

  getCategoryIcon(cat: AuditCategory): string {
    const map: Record<AuditCategory, string> = {
      authentication: '🔐', user_management: '👥', data_access: '📄',
      ai_operations: '🤖', system_config: '⚙️', security_event: '⚠️',
    };
    return map[cat] ?? '📋';
  }

  formatDetails(entry: AuditLogEntry): string {
    const d = entry.details;
    if (!d) return '';
    return Object.entries(d)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(' · ');
  }

  objectKeys(obj: any): string[] { return Object.keys(obj ?? {}); }

  private defaultFilters(): AuditFilters {
    const today = new Date();
    const from  = new Date(today);
    from.setDate(from.getDate() - 30);
    return {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo:   today.toISOString().slice(0, 10),
      category: '',
      severity: [],
      userId: '',
      search: '',
    };
  }
}
