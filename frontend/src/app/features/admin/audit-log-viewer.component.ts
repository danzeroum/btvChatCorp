import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  ipAddress?: string;
}

@Component({
  selector: 'app-audit-log-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-viewer">
      <div class="header">
        <h2>Log de Auditoria</h2>
        <div class="filters">
          <input [(ngModel)]="filterUser" placeholder="Filtrar por usuário"
                 (change)="load()">
          <input type="date" [(ngModel)]="filterDate" (change)="load()">
          <button (click)="exportCsv()">📥 Exportar CSV</button>
        </div>
      </div>

      <table class="audit-table">
        <thead>
          <tr>
            <th>Data/Hora</th><th>Usuário</th><th>Ação</th>
            <th>Recurso</th><th>Status</th><th>Duração</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of entries; track entry.id) {
            <tr [class.error]="entry.statusCode >= 400">
              <td>{{ entry.timestamp | date:'dd/MM/yy HH:mm:ss' }}</td>
              <td>{{ entry.userEmail }}</td>
              <td><span class="method" [class]="entry.action">{{ entry.action }}</span></td>
              <td>{{ entry.resource }}</td>
              <td [class.success]="entry.statusCode < 400">{{ entry.statusCode }}</td>
              <td>{{ entry.durationMs }}ms</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AuditLogViewerComponent implements OnInit {
  private http = inject(HttpClient);

  entries: AuditLogEntry[] = [];
  filterUser = '';
  filterDate = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.http.get<AuditLogEntry[]>('/api/admin/audit-logs', {
      params: { user: this.filterUser, date: this.filterDate }
    }).subscribe(e => this.entries = e);
  }

  exportCsv(): void {
    const headers = 'Data,Usuário,Ação,Recurso,Status,Duração\n';
    const rows = this.entries.map(e =>
      `${e.timestamp},${e.userEmail},${e.action},${e.resource},${e.statusCode},${e.durationMs}ms`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
  }
}
