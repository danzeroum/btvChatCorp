import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h1>Gerenciador de Documentos</h1>
      <div class="upload-area">
        <p>Arraste arquivos ou clique para fazer upload</p>
        <input type="file" multiple (change)="onFileSelect($event)" />
      </div>
      <div class="doc-list">
        <p *ngIf="documents.length === 0">Nenhum documento ainda.</p>
        <div *ngFor="let doc of documents" class="doc-item">
          <span>{{ doc.name }}</span>
          <span class="status">{{ doc.status }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; }
    h1 { margin-bottom: 1.5rem; }
    .upload-area { border: 2px dashed #444; border-radius: 8px; padding: 2rem; text-align: center; margin-bottom: 1.5rem; cursor: pointer; }
    .doc-item { display: flex; justify-content: space-between; padding: 0.75rem; background: #1e1e1e; border-radius: 6px; margin-bottom: 0.5rem; }
    .status { color: #22c55e; font-size: 0.85rem; }
  `]
})
export class DocumentManagerComponent {
  documents: { name: string; status: string }[] = [];

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    Array.from(files).forEach(f => {
      this.documents.push({ name: f.name, status: 'Enviando...' });
      // TODO: integrar com API de upload
    });
  }
}
