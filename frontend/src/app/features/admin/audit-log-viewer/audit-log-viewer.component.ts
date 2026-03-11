import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AuditEntry } from '../admin.service';

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-log">
      <div class="page-header">
        <div><h1>Log de Auditoria</h1><p>Rastreie todas as ações do workspace</p></div>
        <button class="btn-secondary" (click)="exportCsv()">Exportar CSV</button>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <select [(ngModel)]="severityFilter" (change)="loadLogs()">
          <option value="">Todas as severidades</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select [(ngModel)]="actionFilter" (change)="loadLogs()">
          <option value="">Todas as ações</option>
          <option value="login">Login</option>
          <option value="access_denied">Acesso negado</option>
          <option value="document_upload">Upload de documento</option>
          <option value="training_triggered">Treino iniciado</option>
          <option value="lora_deployed">LoRA deploy</option>
          <option value="api_key_created">API key criada</option>
          <option value="api_key_revoked">API key revogada</option>
        </select>
        <select [(ngModel)]="sinceFilter" (change)="loadLogs()">
          <option value="1d">Últimas 24h</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>

      <!-- Tabela de logs -->
      <table class="log-table">
        <thead>
          <tr><th>Hora</th><th>Usuário</th><th>Ação</th><th>Recurso</th><th>Severidade</th><th>IP</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let entry of entries" [class]="'row-' + entry.severity">
            <td class="timestamp">{{ entry.createdAt | date:'dd/MM HH:mm:ss' }}</td>
            <td>{{ entry.userEmail }}</td>
            <td><code>{{ entry.action }}</code></td>
            <td>{{ entry.resource }}</td>
            <td><span class="sev-badge" [class]="'sev-' + entry.severity">{{ entry.severity }}</span></td>
            <td class="ip">{{ entry.ipAddress }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Paginação -->
      <div class="pagination" *ngIf="total > perPage">
        <button [disabled]="page === 1" (click)="prevPage()">←</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button [disabled]="page >= totalPages" (click)="nextPage()">→</button>
      </div>
    </div>
  `,
  styleUrls: ['./audit-log-viewer.component.scss'],
})
export class AuditLogViewerComponent implements OnInit {
  private adminService = inject(AdminService);
  entries: AuditEntry[] = [];
  total = 0; page = 1; perPage = 50;
  severityFilter = ''; actionFilter = ''; sinceFilter = '7d';

  get totalPages() { return Math.ceil(this.total / this.perPage); }

  ngOnInit() { this.loadLogs(); }

  loadLogs() {
    const since = this.sinceFilter ? new Date(Date.now() - this.parseDays(this.sinceFilter)).toISOString() : undefined;
    this.adminService.queryAuditLogs(this.page, this.perPage, this.severityFilter || undefined, this.actionFilter || undefined, since)
      .subscribe(({ entries, total }) => { this.entries = entries; this.total = total; });
  }

  exportCsv() {
    const since = new Date(Date.now() - this.parseDays(this.sinceFilter)).toISOString();
    const until = new Date().toISOString();
    this.adminService.exportAuditCsv(since, until).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_${since.slice(0,10)}_${until.slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  parseDays(s: string): number {
    return parseInt(s) * 24 * 3600 * 1000;
  }

  prevPage() { this.page--; this.loadLogs(); }
  nextPage() { this.page++; this.loadLogs(); }
}
