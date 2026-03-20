import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DataFilterService } from '../../core/services/data-filter.service';
import { genId } from '../../core/utils/uuid';

interface ProcessingFile {
  id: string;
  name: string;
  rawFile: File;
  extractedText: string;
  classification: string;
  piiDetected: number;
  useForTraining: boolean;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

@Component({
  selector: 'app-upload-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="upload-zone"
         (dragover)="$event.preventDefault()"
         (drop)="onDrop($event)">
      <p>Arraste documentos ou clique para selecionar</p>
      <input type="file" multiple
             accept=".pdf,.docx,.txt,.csv,.xlsx"
             (change)="onFileSelect($event)">
    </div>

    @for (file of fileQueue; track file.id) {
      <div class="file-card" [ngClass]="file.classification.toLowerCase()">
        <div class="file-info">
          <span>{{ file.name }}</span>
          <span class="badge">{{ file.classification }}</span>
          @if (file.piiDetected > 0) {
            <span class="pii-warning">⚠️ {{ file.piiDetected }} PII detectado(s)</span>
          }
        </div>

        <select [(ngModel)]="file.classification">
          <option value="PUBLIC">Público</option>
          <option value="INTERNAL">Interno</option>
          <option value="CONFIDENTIAL">Confidencial</option>
          <option value="RESTRICTED">Restrito (não treina)</option>
        </select>

        <label>
          <input type="checkbox"
                 [(ngModel)]="file.useForTraining"
                 [disabled]="file.classification === 'RESTRICTED'">
          Incluir na base de treinamento
        </label>

        <div class="actions">
          <button (click)="processFile(file)" [disabled]="file.status === 'processing'">
            {{ file.status === 'processing' ? 'Processando...' : 'Processar' }}
          </button>
          <button (click)="removeFile(file)">Remover</button>
        </div>
      </div>
    }
  `,
})
export class UploadPipelineComponent {
  private dataFilter = inject(DataFilterService);
  private http = inject(HttpClient);

  fileQueue: ProcessingFile[] = [];

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) this.processFiles(Array.from(files));
  }

  async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files) this.processFiles(Array.from(input.files));
  }

  private async processFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const text = await this.extractText(file);
      const piiCount = this.dataFilter.detectPII(text).length;
      const classification = piiCount > 0 ? 'CONFIDENTIAL' : 'INTERNAL';

      this.fileQueue.push({
        id: genId(),
        name: file.name,
        rawFile: file,
        extractedText: text,
        classification,
        piiDetected: piiCount,
        useForTraining: classification !== 'RESTRICTED',
        status: 'pending',
      });
    }
  }

  async processFile(file: ProcessingFile): Promise<void> {
    file.status = 'processing';
    const formData = new FormData();
    formData.append('file', file.rawFile);
    formData.append('classification', file.classification);
    formData.append('use_for_training', String(file.useForTraining));

    this.http.post('/api/v1/documents/upload', formData).subscribe({
      next: () => file.status = 'completed',
      error: () => file.status = 'error',
    });
  }

  removeFile(file: ProcessingFile): void {
    this.fileQueue = this.fileQueue.filter(f => f.id !== file.id);
  }

  private async extractText(file: File): Promise<string> {
    if (file.type === 'text/plain') {
      return file.text();
    }
    return `[Conteúdo de ${file.name} - processado no servidor]`;
  }
}
