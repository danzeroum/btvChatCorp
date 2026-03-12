import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface DocItem {
  name: string;
  status: 'enviando' | 'ok' | 'erro';
  size?: number;
  error?: string;
}

@Component({
  selector: 'app-document-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h1>Gerenciador de Documentos</h1>

      <div
        class="upload-area"
        (click)="fileInput.click()"
        (dragover)="$event.preventDefault()"
        (drop)="onDrop($event)">
        <div class="upload-icon">📂</div>
        <p>Arraste arquivos ou <strong>clique para fazer upload</strong></p>
        <small>PDF, DOCX, TXT, MD, CSV · máx. 50MB</small>
        <input #fileInput type="file" multiple style="display:none"
          accept=".pdf,.docx,.txt,.md,.csv"
          (change)="onFileSelect($event)" />
      </div>

      <div class="doc-list">
        <p *ngIf="documents.length === 0" class="empty">Nenhum documento enviado ainda.</p>

        <div *ngFor="let doc of documents" class="doc-item">
          <div class="doc-info">
            <span class="doc-icon">{{ iconFor(doc.name) }}</span>
            <div>
              <div class="doc-name">{{ doc.name }}</div>
              <div *ngIf="doc.size" class="doc-size">{{ formatSize(doc.size) }}</div>
            </div>
          </div>
          <span [class]="'status ' + doc.status">
            {{ doc.status === 'enviando' ? '⏳ Enviando...' :
               doc.status === 'ok' ? '✅ Processando' :
               '❌ ' + (doc.error || 'Erro') }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 800px; margin: 0 auto; color: #f0f0f0; }
    h1 { margin-bottom: 1.5rem; font-size: 1.25rem; }
    .upload-area { border: 2px dashed #444; border-radius: 12px; padding: 2.5rem; text-align: center; margin-bottom: 1.5rem; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
    .upload-area:hover { border-color: #2563eb; background: #1a2035; }
    .upload-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .upload-area p { color: #ccc; margin-bottom: 0.25rem; }
    .upload-area small { color: #666; font-size: 0.8rem; }
    .empty { color: #555; text-align: center; padding: 2rem; }
    .doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; background: #1e1e1e; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #2a2a2a; }
    .doc-info { display: flex; align-items: center; gap: 0.75rem; }
    .doc-icon { font-size: 1.25rem; }
    .doc-name { font-size: 0.9rem; color: #e0e0e0; }
    .doc-size { font-size: 0.75rem; color: #666; margin-top: 2px; }
    .status { font-size: 0.8rem; white-space: nowrap; }
    .status.enviando { color: #f59e0b; }
    .status.ok { color: #22c55e; }
    .status.erro { color: #ef4444; }
  `]
})
export class DocumentManagerComponent implements OnInit {
  documents: DocItem[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.http.get<{ documents: any[] }>('/api/v1/documents/').subscribe({
      next: res => {
        this.documents = res.documents.map(d => ({
          name: d.filename,
          status: 'ok' as const,
          size: d.size_bytes,
        }));
      },
      error: () => {}
    });
  }

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    this.uploadFiles(Array.from(files));
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files) return;
    this.uploadFiles(Array.from(files));
  }

  uploadFiles(files: File[]) {
    files.forEach(file => {
      const item: DocItem = { name: file.name, status: 'enviando', size: file.size };
      this.documents.unshift(item);

      const form = new FormData();
      form.append('file', file);

      this.http.post<any>('/api/v1/documents/upload', form).subscribe({
        next: () => { item.status = 'ok'; },
        error: (err) => {
          item.status = 'erro';
          item.error = err?.error?.detail || 'Erro no upload';
        }
      });
    });
  }

  iconFor(name: string): string {
    if (name.endsWith('.pdf')) return '📄';
    if (name.endsWith('.docx') || name.endsWith('.doc')) return '📝';
    if (name.endsWith('.csv')) return '📈';
    if (name.endsWith('.md')) return '📌';
    return '📃';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
}
