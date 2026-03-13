import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  chunk_count: number;
  created_at: string;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Documentos</h1>
          <p class="subtitle">{{ documents().length }} documento(s) na base de conhecimento</p>
        </div>
        <div class="header-actions">
          <input class="search-input" type="text" placeholder="Buscar..."
                 [value]="search()" (input)="search.set($any($event.target).value)" />
          <button class="btn-primary" (click)="showUpload.set(!showUpload())">+ Upload</button>
        </div>
      </div>

      <!-- Painel de Upload -->
      @if (showUpload()) {
        <div class="upload-panel">
          <div class="drop-zone"
               [class.drag-over]="isDragging()"
               (dragover)="onDragOver($event)"
               (dragleave)="isDragging.set(false)"
               (drop)="onDrop($event)"
               (click)="fileInput.click()">
            <div class="drop-icon">📁</div>
            <p>Arraste arquivos aqui ou <span class="link">clique para selecionar</span></p>
            <p class="hint">PDF, DOCX, TXT, CSV, XLSX — máx. 50MB por arquivo</p>
            <input #fileInput type="file" multiple
                   accept=".pdf,.docx,.txt,.csv,.xlsx"
                   style="display:none"
                   (change)="onFileSelect($event)" />
          </div>

          @if (uploading().length > 0) {
            <div class="upload-queue">
              @for (f of uploading(); track f.id) {
                <div class="upload-item" [class]="f.status">
                  <div class="upload-info">
                    <span class="upload-name">{{ f.name }}</span>
                    <span class="upload-size">{{ formatSize(f.size) }}</span>
                  </div>
                  @if (f.status === 'uploading') {
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="f.progress"></div>
                    </div>
                    <span class="progress-pct">{{ f.progress }}%</span>
                  }
                  @if (f.status === 'done') { <span class="status-ok">✅ Enviado</span> }
                  @if (f.status === 'error') { <span class="status-err">❌ {{ f.error }}</span> }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Tabela de documentos -->
      @if (loading()) {
        <div class="loading">Carregando documentos...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>{{ search() ? 'Nenhum resultado.' : 'Nenhum documento ainda. Faça o primeiro upload!' }}</p>
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
                <th>Enviado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (doc of filtered(); track doc.id) {
                <tr>
                  <td class="doc-name-cell" [title]="doc.original_filename || doc.filename">
                    {{ doc.original_filename || doc.filename }}
                  </td>
                  <td><span class="type-badge">{{ mimeShort(doc.mime_type) }}</span></td>
                  <td>{{ formatSize(doc.size_bytes) }}</td>
                  <td>{{ doc.chunk_count ?? '-' }}</td>
                  <td>
                    <span class="status-badge" [class]="doc.processing_status">
                      {{ statusLabel(doc.processing_status) }}
                    </span>
                  </td>
                  <td>{{ doc.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    <button class="del-btn" (click)="deleteDoc(doc)" title="Remover">🗑</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 1100px; margin: 0 auto; color: #f0f0f0; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    .subtitle { color: #888; font-size: 0.85rem; margin: 0; }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    .search-input { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 8px 14px; color: #f0f0f0; font-size: 0.85rem; width: 200px; }
    .btn-primary { background: #6366f1; color: #fff; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.85rem; }

    /* Upload panel */
    .upload-panel { background: #161616; border: 1px solid #2a2a2a; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .drop-zone { border: 2px dashed #333; border-radius: 10px; padding: 2rem; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .drop-zone:hover, .drop-zone.drag-over { border-color: #6366f1; background: #6366f108; }
    .drop-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .drop-zone p { margin: 4px 0; color: #aaa; font-size: 0.9rem; }
    .drop-zone .hint { font-size: 0.75rem; color: #555; }
    .link { color: #6366f1; text-decoration: underline; }
    .upload-queue { margin-top: 1rem; display: flex; flex-direction: column; gap: 8px; }
    .upload-item { display: flex; align-items: center; gap: 12px; background: #1e1e1e; border-radius: 8px; padding: 10px 14px; }
    .upload-info { flex: 1; min-width: 0; }
    .upload-name { display: block; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .upload-size { font-size: 0.75rem; color: #666; }
    .progress-bar { flex: 1; height: 4px; background: #2a2a2a; border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; background: #6366f1; transition: width 0.2s; }
    .progress-pct { font-size: 0.75rem; color: #888; min-width: 36px; text-align: right; }
    .status-ok { font-size: 0.8rem; color: #22c55e; }
    .status-err { font-size: 0.8rem; color: #ef4444; }

    /* Tabela */
    .loading, .empty-state { text-align: center; padding: 3rem; color: #888; }
    .empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .doc-table { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 12px 16px; text-align: left; font-size: 0.8rem; color: #777; border-bottom: 1px solid #2a2a2a; background: #161616; }
    td { padding: 11px 16px; font-size: 0.85rem; border-bottom: 1px solid #1a1a1a; }
    tr:last-child td { border-bottom: none; }
    .doc-name-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type-badge { background: #2a2a2a; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #aaa; }
    .status-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
    .status-badge.pending    { background: #f59e0b22; color: #f59e0b; }
    .status-badge.processing { background: #6366f122; color: #818cf8; }
    .status-badge.completed  { background: #22c55e22; color: #22c55e; }
    .status-badge.failed     { background: #ef444422; color: #ef4444; }
    .del-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.4; transition: opacity 0.15s; padding: 2px 6px; }
    .del-btn:hover { opacity: 1; }
  `]
})
export class DocumentViewerComponent implements OnInit {
  documents = signal<DocumentItem[]>([]);
  loading    = signal(true);
  search     = signal('');
  showUpload = signal(false);
  isDragging = signal(false);
  uploading  = signal<UploadingFile[]>([]);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.documents();
    return this.documents().filter(d =>
      (d.original_filename || d.filename).toLowerCase().includes(q)
    );
  });

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadDocs(); }

  loadDocs() {
    this.loading.set(true);
    this.http.get<DocumentItem[]>('/api/v1/documents').subscribe({
      next: docs => { this.documents.set(docs ?? []); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  /* ── drag & drop ── */
  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) this.uploadFiles(files);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length) this.uploadFiles(files);
    input.value = '';
  }

  /* ── upload ── */
  uploadFiles(files: File[]) {
    this.showUpload.set(true);
    for (const file of files) {
      const entry: UploadingFile = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'uploading',
      };
      this.uploading.update(list => [...list, entry]);

      const formData = new FormData();
      formData.append('file', file);

      this.http.post<DocumentItem>('/api/v1/documents', formData, {
        reportProgress: true,
        observe: 'events',
      }).subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const pct = Math.round(100 * event.loaded / event.total);
            this.uploading.update(list =>
              list.map(u => u.id === entry.id ? { ...u, progress: pct } : u)
            );
          } else if (event.type === HttpEventType.Response && event.body) {
            this.uploading.update(list =>
              list.map(u => u.id === entry.id ? { ...u, status: 'done', progress: 100 } : u)
            );
            // Adiciona o novo documento no topo da lista
            this.documents.update(docs => [event.body!, ...docs]);
          }
        },
        error: err => {
          const msg = err.error?.message || err.error?.detail || 'Erro no upload';
          this.uploading.update(list =>
            list.map(u => u.id === entry.id ? { ...u, status: 'error', error: msg } : u)
          );
        },
      });
    }
  }

  /* ── delete ── */
  deleteDoc(doc: DocumentItem) {
    if (!confirm(`Remover "${doc.original_filename || doc.filename}"?`)) return;
    this.http.delete(`/api/v1/documents/${doc.id}`).subscribe({
      next: () => this.documents.update(docs => docs.filter(d => d.id !== doc.id)),
      error: err => alert(err.error?.message || 'Erro ao remover documento'),
    });
  }

  /* ── helpers ── */
  formatSize(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  mimeShort(mime: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'text/plain': 'TXT',
      'text/csv': 'CSV',
    };
    return map[mime] || mime.split('/').pop()?.toUpperCase() || 'FILE';
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      pending:    '⏳ Aguardando',
      processing: '⚙️ Processando',
      completed:  '✅ Pronto',
      failed:     '❌ Falhou',
    };
    return map[s] || s;
  }
}
