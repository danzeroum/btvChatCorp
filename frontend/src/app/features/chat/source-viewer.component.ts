import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RAGSource } from './message-display.component';

/**
 * Exibe os documentos RAG utilizados na resposta.
 * Permite ao usuário inspecionar de onde veio cada informação.
 */
@Component({
  selector: 'app-source-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="source-viewer">
      <div class="source-viewer-header" (click)="expanded = !expanded">
        <span>\uD83D\uDD0D Fontes consultadas ({{ sources.length }})</span>
        <span class="relevance-avg">
          Relevância média: {{ avgScore | number:'1.0-0' }}%
        </span>
        <button class="expand-btn">{{ expanded ? '\u25B2' : '\u25BC' }}</button>
      </div>

      @if (expanded) {
        <div class="sources-grid">
          @for (src of sortedSources; track src.documentId + src.chunkIndex) {
            <div
              class="source-card"
              [class.high-relevance]="src.score >= 0.85"
              (click)="onSourceClick(src)">

              <div class="source-card-header">
                <span class="doc-icon">\uD83D\uDCC4</span>
                <span class="doc-name">{{ src.documentName }}</span>
                <span class="relevance-badge" [class]="getRelevanceClass(src.score)">
                  {{ (src.score * 100).toFixed(0) }}%
                </span>
              </div>

              @if (src.sectionTitle) {
                <div class="section-title">{{ src.sectionTitle }}</div>
              }

              <p class="snippet">{{ src.snippet }}</p>

              <div class="source-meta">
                <span>Chunk {{ src.chunkIndex + 1 }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SourceViewerComponent {
  @Input({ required: true }) sources: RAGSource[] = [];
  @Output() sourceClicked = new EventEmitter<RAGSource>();

  expanded = false;

  get sortedSources(): RAGSource[] {
    return [...this.sources].sort((a, b) => b.score - a.score);
  }

  get avgScore(): number {
    if (!this.sources.length) return 0;
    const sum = this.sources.reduce((acc, s) => acc + s.score, 0);
    return (sum / this.sources.length) * 100;
  }

  getRelevanceClass(score: number): string {
    if (score >= 0.85) return 'high';
    if (score >= 0.65) return 'medium';
    return 'low';
  }

  onSourceClick(src: RAGSource): void {
    this.sourceClicked.emit(src);
  }
}
