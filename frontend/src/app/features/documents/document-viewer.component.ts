import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface DocumentDetail {
  id: string;
  name: string;
  mimeType: string;
  classification: string;
  chunkCount: number;
  tokenCount: number;
  useForTraining: boolean;
  status: 'processing' | 'indexed' | 'error';
  createdAt: string;
}

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="document-viewer">
      @if (loading) {
        <p>Carregando documentos...</p>
      } @else {
        <table class="docs-table">
          <thead>
            <tr>
              <th>Nome</th><th>Classificação</th><th>Chunks</th>
              <th>Tokens</th><th>Treino</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (doc of documents; track doc.id) {
              <tr (click)="selectDoc(doc)" [class.selected]="selectedDoc?.id === doc.id">
                <td>{{ doc.name }}</td>
                <td><span class="badge" [class]="doc.classification.toLowerCase()">{{ doc.classification }}</span></td>
                <td>{{ doc.chunkCount }}</td>
                <td>{{ doc.tokenCount | number }}</td>
                <td>{{ doc.useForTraining ? '✅' : '—' }}</td>
                <td><span class="status" [class]="doc.status">{{ doc.status }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `
})
export class DocumentViewerComponent implements OnInit {
  @Input() workspaceId = '';
  @Input() projectId = '';

  private http = inject(HttpClient);

  documents: DocumentDetail[] = [];
  selectedDoc: DocumentDetail | null = null;
  loading = true;

  ngOnInit(): void {
    this.http.get<DocumentDetail[]>(`/api/projects/${this.projectId}/documents`)
      .subscribe(docs => {
        this.documents = docs;
        this.loading = false;
      });
  }

  selectDoc(doc: DocumentDetail): void {
    this.selectedDoc = doc;
  }
}
