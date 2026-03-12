import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_count: number;
  created_at: string;
  tags?: string[];
}

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Documentos</h1>
          <p class="subtitle">{{ documents().length }} documento(s) na base de conhecimento</p>
        </div>
        <div class="header-actions">
          <input class="search-input" type="text" placeholder="Buscar..."
                 [value]="search()"
                 (input)="search.set($any($event.target).value)" />
          <a routerLink="/document-manager" class="btn-primary">+ Upload</a>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">Carregando documentos...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <div>📭</div>
          <p>{{ search() ? 'Nenhum resultado.' : 'Nenhum documento ainda.' }}</p>
        </div>
      } @else {
        <div class="doc-table">
          <table>
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tipo</th>
                <th>Tamanho</th>
                <th>Chunks</th>
                <th>Status</th>
                <th>Adicionado</th>
              </tr>
            </thead>
            <tbody>
              @for (doc of filtered(); track doc.id) {
                <tr>
                  <td class="doc-name-cell">{{ doc.filename }}</td>
                  <td><span class="type-badge">{{ doc.file_type }}</span></td>
                  <td>{{ formatSize(doc.size_bytes) }}</td>
                  <td>{{ doc.chunks_count }}</td>
                  <td>
                    <span class="status-badge" [class]="doc.processing_status">
                      {{ statusLabel(doc.processing_status) }}
                    </span>
                  </td>
                  <td>{{ doc.created_at | date:'dd/MM/yyyy' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    .subtitle { color: #888; font-size: 0.85rem; margin: 0; }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    .search-input { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 8px 14px; color: #f0f0f0; font-size: 0.85rem; }
    .btn-primary { background: #6366f1; color: #fff; padding: 8px 18px; border-radius: 8px; text-decoration: none; font-size: 0.85rem; }
    .loading, .empty-state { text-align: center; padding: 3rem; color: #888; font-size: 1.1rem; }
    .doc-table { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 12px 16px; text-align: left; font-size: 0.8rem; color: #777; border-bottom: 1px solid #2a2a2a; background: #161616; }
    td { padding: 12px 16px; font-size: 0.85rem; border-bottom: 1px solid #1a1a1a; }
    tr:last-child td { border-bottom: none; }
    .doc-name-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type-badge { background: #2a2a2a; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #aaa; }
    .status-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
    .status-badge.pending { background: #f59e0b22; color: #f59e0b; }
    .status-badge.processing { background: #6366f122; color: #818cf8; }
    .status-badge.completed { background: #22c55e22; color: #22c55e; }
    .status-badge.failed { background: #ef444422; color: #ef4444; }
  `]
})
export class DocumentViewerComponent implements OnInit {
  documents = signal<DocumentItem[]>([]);
  loading = signal(true);
  search = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return q ? this.documents().filter(d => d.filename.toLowerCase().includes(q)) : this.documents();
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<{ documents: DocumentItem[] }>('/api/v1/documents/').subscribe({
      next: res => { this.documents.set(res.documents); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = { pending: '⏳ Aguardando', processing: '⚙️ Processando', completed: '✅ Pronto', failed: '❌ Falhou' };
    return map[s] || s;
  }
}
