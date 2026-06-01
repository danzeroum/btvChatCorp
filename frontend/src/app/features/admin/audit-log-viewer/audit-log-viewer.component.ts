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

      <!-- Filtros (severity e category são os honrados pelo backend) -->
      <div class="filters">
        <select [(ngModel)]="severityFilter" (change)="reload()">
          <option value="">Todas as severidades</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select [(ngModel)]="categoryFilter" (change)="reload()">
          <option value="">Todas as categorias</option>
          <option value="auth">Autenticação</option>
          <option value="user">Usuários</option>
          <option value="data">Dados</option>
          <option value="security">Segurança</option>
          <option value="training">Treinamento</option>
          <option value="system">Sistema</option>
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
            <td>{{ entry.userName }}</td>
            <td><code>{{ entry.action }}</code></td>
            <td>{{ entry.resourceName }}</td>
            <td><span class="sev-badge" [class]="'sev-' + entry.severity">{{ entry.severity }}</span></td>
            <td class="ip">{{ entry.userIp }}</td>
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
  severityFilter = ''; categoryFilter = '';

  get totalPages() { return Math.ceil(this.total / this.perPage); }

  ngOnInit() { this.loadLogs(); }

  loadLogs() {
    this.adminService.queryAuditLogs(
      this.page, this.perPage,
      this.severityFilter || undefined, this.categoryFilter || undefined,
    ).subscribe((res) => { this.entries = res.entries; this.total = res.total; });
  }

  reload() { this.page = 1; this.loadLogs(); }

  exportCsv() {
    const until = new Date().toISOString();
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    this.adminService.exportAuditCsv(since, until).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_${since.slice(0,10)}_${until.slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  prevPage() { this.page--; this.loadLogs(); }
  nextPage() { this.page++; this.loadLogs(); }
}
