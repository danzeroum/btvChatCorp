import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  method: string;
  statusCode: number;
  ipAddress: string;
  correlationId: string;
  durationMs: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="audit-log-viewer">
      <div class="audit-header">
        <h2>&#128220; Log de Auditoria</h2>
        <button class="btn-export" (click)="exportCsv()">&#128229; Exportar CSV</button>
      </div>

      <!-- Filtros -->
      <div class="audit-filters">
        <input
          type="search"
          [(ngModel)]="filters.search"
          (ngModelChange)="load()"
          placeholder="Buscar por usuário, ação, recurso..." />
        <input type="date" [(ngModel)]="filters.from" (ngModelChange)="load()" />
        <input type="date" [(ngModel)]="filters.to" (ngModelChange)="load()" />
        <select [(ngModel)]="filters.method" (ngModelChange)="load()">
          <option value="">Todos os métodos</option>
          <option>POST</option><option>PUT</option>
          <option>DELETE</option><option>PATCH</option>
        </select>
        <select [(ngModel)]="filters.status" (ngModelChange)="load()">
          <option value="">Todos os status</option>
          <option value="success">&#9989; Sucesso (2xx)</option>
          <option value="error">&#10060; Erro (4xx/5xx)</option>
        </select>
      </div>

      <!-- Tabela -->
      @if (loading()) {
        <div class="loading">Carregando logs...</div>
      } @else if (entries().length === 0) {
        <div class="empty-state">Nenhum log encontrado.</div>
      } @else {
        <div class="audit-table-wrapper">
          <table class="audit-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Recurso</th>
                <th>Método</th>
                <th>Status</th>
                <th>Duração</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of entries(); track entry.id) {
                <tr
                  [class.error-row]="entry.statusCode >= 400"
                  (click)="selectEntry(entry)"
                  [class.selected]="selected()?.id === entry.id">
                  <td>{{ entry.timestamp | date:'dd/MM HH:mm:ss' }}</td>
                  <td>
                    <span class="user-pill">{{ entry.userName }}</span>
                  </td>
                  <td><code>{{ entry.action }}</code></td>
                  <td>{{ entry.resource }}{{ entry.resourceId ? '#' + entry.resourceId : '' }}</td>
                  <td><span class="method-badge" [class]="entry.method.toLowerCase()">{{ entry.method }}</span></td>
                  <td>
                    <span [class]="entry.statusCode < 400 ? 'status-ok' : 'status-err'">
                      {{ entry.statusCode }}
                    </span>
                  </td>
                  <td>{{ entry.durationMs }}ms</td>
                  <td class="ip">{{ entry.ipAddress }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginação -->
        <div class="pagination">
          <button [disabled]="page() === 1" (click)="changePage(page() - 1)">&#8592; Anterior</button>
          <span>Página {{ page() }} de {{ totalPages() }}</span>
          <button [disabled]="page() >= totalPages()" (click)="changePage(page() + 1)">Próxima &#8594;</button>
        </div>

        <!-- Detalhe do evento selecionado -->
        @if (selected()) {
          <div class="entry-detail">
            <h4>Detalhe do evento</h4>
            <dl>
              <dt>Correlation ID</dt><dd><code>{{ selected()!.correlationId }}</code></dd>
              <dt>Metadados</dt>
              <dd><pre>{{ selected()!.metadata | json }}</pre></dd>
            </dl>
          </div>
        }
      }
    </div>
  `
})
export class AuditLogViewerComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  entries = signal<AuditLogEntry[]>([]);
  selected = signal<AuditLogEntry | null>(null);
  page = signal(1);
  totalPages = signal(1);
  perPage = 50;

  filters = { search: '', from: '', to: '', method: '', status: '' };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const wsId = this.workspaceCtx.workspaceId();
    const params = this.buildParams();
    this.http
      .get<{ entries: AuditLogEntry[]; total: number }>(
        `/api/admin/workspaces/${wsId}/audit-logs`, { params }
      )
      .subscribe({
        next: ({ entries, total }) => {
          this.entries.set(entries);
          this.totalPages.set(Math.max(1, Math.ceil(total / this.perPage)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  changePage(p: number): void {
    this.page.set(p);
    this.load();
  }

  selectEntry(entry: AuditLogEntry): void {
    this.selected.set(this.selected()?.id === entry.id ? null : entry);
  }

  exportCsv(): void {
    const wsId = this.workspaceCtx.workspaceId();
    const params = this.buildParams();
    window.open(`/api/admin/workspaces/${wsId}/audit-logs/export?${new URLSearchParams(params as Record<string,string>)}`);
  }

  private buildParams(): Record<string, string> {
    const p: Record<string, string> = {
      page: String(this.page()),
      perPage: String(this.perPage),
    };
    if (this.filters.search) p['search'] = this.filters.search;
    if (this.filters.from) p['from'] = this.filters.from;
    if (this.filters.to) p['to'] = this.filters.to;
    if (this.filters.method) p['method'] = this.filters.method;
    if (this.filters.status) p['status'] = this.filters.status;
    return p;
  }
}
