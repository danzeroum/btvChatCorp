import {
  Component, Input, Output, EventEmitter, OnInit, inject, signal
} from '@angular/core';
import { CommonModule, DatePipe, FileSizePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface Document {
  id: string;
  name: string;
  mimeType: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  useForTraining: boolean;
  chunkCount: number;
  pageCount?: number;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  status: 'processing' | 'indexed' | 'error';
  sector?: string;
  tags: string[];
}

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="document-viewer">

      <!-- Header com busca e filtros -->
      <div class="viewer-header">
        <input
          type="search"
          [(value)]="searchTerm"
          (input)="onSearch($event)"
          placeholder="Buscar documentos..."
          class="search-input" />

        <select (change)="onFilterChange($event)" class="filter-select">
          <option value="">Todas as classificações</option>
          <option value="PUBLIC">Público</option>
          <option value="INTERNAL">Interno</option>
          <option value="CONFIDENTIAL">Confidencial</option>
          <option value="RESTRICTED">Restrito</option>
        </select>

        <select (change)="onStatusFilter($event)" class="filter-select">
          <option value="">Todos os status</option>
          <option value="indexed">Indexado</option>
          <option value="processing">Processando</option>
          <option value="error">Erro</option>
        </select>
      </div>

      <!-- Lista de documentos -->
      @if (loading()) {
        <div class="loading">Carregando documentos...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <span>&#128196;</span>
          <p>Nenhum documento encontrado.</p>
        </div>
      } @else {
        <div class="documents-table">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Classificação</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Treino</th>
                <th>Enviado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (doc of filtered(); track doc.id) {
                <tr [class.error]="doc.status === 'error'">
                  <td class="doc-name">
                    <span class="doc-icon">{{ getMimeIcon(doc.mimeType) }}</span>
                    {{ doc.name }}
                    @if (doc.tags.length) {
                      <div class="doc-tags">
                        @for (tag of doc.tags; track tag) {
                          <span class="tag">{{ tag }}</span>
                        }
                      </div>
                    }
                  </td>
                  <td>
                    <span class="badge" [class]="doc.classification.toLowerCase()">
                      {{ doc.classification }}
                    </span>
                  </td>
                  <td>
                    <span class="status-dot" [class]="doc.status"></span>
                    {{ doc.status }}
                  </td>
                  <td>{{ doc.chunkCount }}</td>
                  <td>
                    <span [class]="doc.useForTraining ? 'check' : 'cross'">
                      {{ doc.useForTraining ? '\u2705' : '\u274c' }}
                    </span>
                  </td>
                  <td>{{ doc.uploadedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="actions">
                    <button (click)="viewChunks(doc)" title="Ver chunks">🔍</button>
                    <button (click)="reprocess(doc)" title="Reprocessar">🔄</button>
                    <button (click)="deleteDoc(doc)" title="Excluir" class="danger">🗑️</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class DocumentViewerComponent implements OnInit {
  @Input() workspaceId!: string;
  @Output() chunksRequested = new EventEmitter<Document>();

  private http = inject(HttpClient);

  loading = signal(true);
  documents = signal<Document[]>([]);
  filtered = signal<Document[]>([]);
  searchTerm = '';
  classFilter = '';
  statusFilter = '';

  ngOnInit(): void {
    this.http
      .get<Document[]>(`/api/workspaces/${this.workspaceId}/documents`)
      .subscribe({
        next: (docs) => {
          this.documents.set(docs);
          this.filtered.set(docs);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  onFilterChange(event: Event): void {
    this.classFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  onStatusFilter(event: Event): void {
    this.statusFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  private applyFilters(): void {
    let result = this.documents();
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(term) || d.tags.some((t) => t.includes(term))
      );
    }
    if (this.classFilter) result = result.filter((d) => d.classification === this.classFilter);
    if (this.statusFilter) result = result.filter((d) => d.status === this.statusFilter);
    this.filtered.set(result);
  }

  getMimeIcon(mime: string): string {
    if (mime.includes('pdf')) return '\uD83D\uDCC4';
    if (mime.includes('word') || mime.includes('document')) return '\uD83D\uDCD8';
    if (mime.includes('sheet') || mime.includes('csv')) return '\uD83D\uDCCA';
    if (mime.includes('text')) return '\uD83D\uDCDD';
    return '\uD83D\uDCC1';
  }

  viewChunks(doc: Document): void {
    this.chunksRequested.emit(doc);
  }

  reprocess(doc: Document): void {
    this.http
      .post(`/api/documents/${doc.id}/reprocess`, {})
      .subscribe(() => {
        this.documents.update((docs) =>
          docs.map((d) => (d.id === doc.id ? { ...d, status: 'processing' } : d))
        );
        this.applyFilters();
      });
  }

  deleteDoc(doc: Document): void {
    if (!confirm(`Excluir "${doc.name}"? Esta ação não pode ser desfeita.`)) return;
    this.http.delete(`/api/documents/${doc.id}`).subscribe(() => {
      this.documents.update((docs) => docs.filter((d) => d.id !== doc.id));
      this.applyFilters();
    });
  }
}
