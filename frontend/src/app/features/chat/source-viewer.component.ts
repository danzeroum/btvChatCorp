import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RAGSource } from '../../shared/models/message.model';

@Component({
  selector: 'app-source-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="source-viewer">
      <button class="toggle-btn" (click)="expanded = !expanded">
        📄 {{ sources.length }} fonte(s) RAG utilizada(s)
        {{ expanded ? '▲' : '▼' }}
      </button>

      @if (expanded) {
        <div class="sources-list">
          @for (src of sources; track src.chunkId) {
            <div class="source-card">
              <div class="source-header">
                <strong>{{ src.documentName }}</strong>
                @if (src.sectionTitle) {
                  <span class="section-title">— {{ src.sectionTitle }}</span>
                }
                <span class="score-badge"
                      [class.high]="src.similarityScore > 0.85"
                      [class.medium]="src.similarityScore > 0.7">
                  {{ (src.similarityScore * 100).toFixed(1) }}%
                </span>
              </div>
              <p class="excerpt">{{ src.excerpt }}</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SourceViewerComponent {
  @Input() sources: RAGSource[] = [];
  expanded = false;
}
