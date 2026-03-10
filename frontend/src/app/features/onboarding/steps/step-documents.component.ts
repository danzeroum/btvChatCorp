import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OnboardingService } from '../services/onboarding.service';

interface UploadedFile {
  name: string;
  sizeMb: string;
  status: 'uploading' | 'done' | 'error';
}

@Component({
  selector: 'app-step-documents',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="step-documents">
      <div class="step-header">
        <span class="step-emoji">&#128196;</span>
        <h2>Alimente sua IA com conhecimento</h2>
        <p>Envie os documentos que a IA deve conhecer. Pode adicionar mais depois.</p>
      </div>

      <!-- Drop zone -->
      <div class="drop-zone"
        [class.dragover]="isDragging"
        (dragover)="onDragOver($event)"
        (dragleave)="isDragging = false"
        (drop)="onDrop($event)"
        (click)="fileInput.click()">
        <input #fileInput type="file" multiple
          accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
          style="display:none"
          (change)="onFilesSelected($event)" />
        <span class="drop-icon">&#128228;</span>
        <p>Arraste arquivos aqui ou <strong>clique para selecionar</strong></p>
        <small>PDF, DOCX, XLSX, TXT, Markdown &bull; At\xE9 50MB por arquivo</small>
      </div>

      <!-- Arquivos enviados -->
      @if (files().length > 0) {
        <div class="files-list">
          @for (file of files(); track file.name) {
            <div class="file-row" [class]="file.status">
              <span class="file-icon">&#128196;</span>
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ file.sizeMb }} MB</span>
              <span class="file-status">
                @switch (file.status) {
                  @case ('uploading') { <span class="spinner"></span> Enviando... }
                  @case ('done') { &#9989; }
                  @case ('error') { &#10060; Erro }
                }
              </span>
            </div>
          }
        </div>
      }

      <p class="skip-hint">Pular esta etapa? Sem problema, adicione documentos depois.</p>
    </div>
  `
})
export class StepDocumentsComponent {
  private http = inject(HttpClient);
  private onboardingService = inject(OnboardingService);

  files = signal<UploadedFile[]>([]);
  isDragging = false;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const dt = event.dataTransfer;
    if (dt?.files) this.uploadFiles(Array.from(dt.files));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.uploadFiles(Array.from(input.files));
  }

  uploadFiles(fileList: File[]): void {
    for (const file of fileList) {
      const entry: UploadedFile = {
        name: file.name,
        sizeMb: (file.size / 1024 / 1024).toFixed(1),
        status: 'uploading',
      };
      this.files.update((f) => [...f, entry]);

      const fd = new FormData();
      fd.append('file', file);

      this.http.post<{ id: string }>('/api/documents/upload', fd).subscribe({
        next: (res) => {
          this.files.update((f) => f.map((x) => x.name === file.name ? { ...x, status: 'done' } : x));
          this.onboardingService.addUploadedDoc(res.id);
        },
        error: () => {
          this.files.update((f) => f.map((x) => x.name === file.name ? { ...x, status: 'error' } : x));
        },
      });
    }
  }
}
