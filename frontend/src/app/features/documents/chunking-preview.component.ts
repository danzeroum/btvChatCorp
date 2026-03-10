import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChunkPreview {
  index: number;
  content: string;
  tokenCount: number;
}

@Component({
  selector: 'app-chunking-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chunking-preview">
      <div class="preview-header">
        <span>{{ chunks.length }} chunks · {{ totalTokens }} tokens</span>
        <button (click)="show = !show">{{ show ? 'Ocultar' : 'Visualizar chunks' }}</button>
      </div>

      @if (show) {
        <div class="chunks-list">
          @for (chunk of chunks; track chunk.index) {
            <div class="chunk-card">
              <span class="chunk-label">Chunk {{ chunk.index + 1 }} · {{ chunk.tokenCount }} tokens</span>
              <p class="chunk-text">{{ chunk.content | slice:0:200 }}{{ chunk.content.length > 200 ? '...' : '' }}</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ChunkingPreviewComponent implements OnChanges {
  @Input() content = '';
  @Input() chunkSize = 512;
  @Input() overlap = 50;

  chunks: ChunkPreview[] = [];
  totalTokens = 0;
  show = false;

  ngOnChanges(): void {
    this.buildPreview();
  }

  private buildPreview(): void {
    if (!this.content) { this.chunks = []; return; }

    const words = this.content.split(' ');
    const result: ChunkPreview[] = [];
    const step = this.chunkSize - this.overlap;
    let i = 0;

    while (i < words.length) {
      const slice = words.slice(i, i + this.chunkSize);
      result.push({
        index: result.length,
        content: slice.join(' '),
        tokenCount: slice.length, // aproximação simples
      });
      i += step;
    }

    this.chunks = result;
    this.totalTokens = words.length;
  }
}
