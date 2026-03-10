import {
  Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ChunkPreview {
  index: number;
  content: string;
  tokenCount: number;
  type: string;
  sectionTitle?: string;
}

/**
 * Visualiza como um documento será fatiado (chunked) antes do envio.
 * Permite ao usuário ajustar os parâmetros e ver o resultado em tempo real.
 */
@Component({
  selector: 'app-chunking-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chunking-preview">
      <div class="preview-header">
        <h4>&#128201; Preview de Chunking</h4>

        <div class="chunk-controls">
          <label>
            Tamanho (tokens):
            <input
              type="number"
              [(ngModel)]="chunkSize"
              (ngModelChange)="regenerate()"
              min="128" max="2048" step="64" />
          </label>
          <label>
            Overlap:
            <input
              type="number"
              [(ngModel)]="overlap"
              (ngModelChange)="regenerate()"
              min="0" max="200" step="10" />
          </label>
          <label>
            Estratégia:
            <select [(ngModel)]="strategy" (ngModelChange)="regenerate()">
              <option value="semantic">Semântico</option>
              <option value="fixed">Tamanho fixo</option>
              <option value="sentence">Por sentenças</option>
              <option value="legal">Jurídico</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Métricas gerais -->
      <div class="chunk-metrics">
        <span>&#128290; {{ chunks().length }} chunks</span>
        <span>&#9993; Média: {{ avgTokens() }} tokens/chunk</span>
        <span>&#128197; Máx: {{ maxTokens() }} tokens</span>
      </div>

      <!-- Visualização dos chunks -->
      <div class="chunks-list">
        @for (chunk of chunks(); track chunk.index) {
          <div
            class="chunk-card"
            [class.selected]="selectedIndex === chunk.index"
            (click)="selectedIndex = chunk.index">

            <div class="chunk-header">
              <span class="chunk-num">#{{ chunk.index + 1 }}</span>
              @if (chunk.sectionTitle) {
                <span class="chunk-section">{{ chunk.sectionTitle }}</span>
              }
              <span class="chunk-type">{{ chunk.type }}</span>
              <span class="chunk-tokens"
                [class.over]="chunk.tokenCount > chunkSize * 0.9">
                {{ chunk.tokenCount }} tokens
              </span>
            </div>

            @if (selectedIndex === chunk.index) {
              <div class="chunk-content">
                <pre>{{ chunk.content }}</pre>
              </div>
            } @else {
              <p class="chunk-snippet">{{ chunk.content.slice(0, 120) }}...</p>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class ChunkingPreviewComponent implements OnChanges {
  @Input({ required: true }) content = '';
  @Input() chunkSize = 512;
  @Input() overlap = 50;
  @Input() strategy: 'semantic' | 'fixed' | 'sentence' | 'legal' = 'semantic';

  chunks = signal<ChunkPreview[]>([]);
  selectedIndex: number | null = null;

  get avgTokens(): () => number {
    return () => {
      const c = this.chunks();
      if (!c.length) return 0;
      return Math.round(c.reduce((sum, ch) => sum + ch.tokenCount, 0) / c.length);
    };
  }

  get maxTokens(): () => number {
    return () => {
      const c = this.chunks();
      if (!c.length) return 0;
      return Math.max(...c.map((ch) => ch.tokenCount));
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] || changes['chunkSize'] || changes['overlap'] || changes['strategy']) {
      this.regenerate();
    }
  }

  regenerate(): void {
    if (!this.content?.trim()) {
      this.chunks.set([]);
      return;
    }
    // Simulação client-side do chunking (preview rápido)
    // O chunking real acontece no backend (Rust)
    const simulated = this.simulateChunking(
      this.content, this.chunkSize, this.overlap, this.strategy
    );
    this.chunks.set(simulated);
  }

  private simulateChunking(
    text: string,
    size: number,
    overlap: number,
    strategy: string
  ): ChunkPreview[] {
    // Estimativa simples: 1 token ≈ 4 caracteres (português)
    const charPerToken = 4;
    const chunkChars = size * charPerToken;
    const overlapChars = overlap * charPerToken;

    const chunks: ChunkPreview[] = [];
    let start = 0;
    let index = 0;

    if (strategy === 'legal') {
      // Divide por cláusulas
      const clauseRe = /(?:CLÁUSULA|Cláusula|Art\.?|Artigo)\s*\d+/gi;
      const positions: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = clauseRe.exec(text)) !== null) positions.push(m.index);

      if (positions.length > 1) {
        for (let i = 0; i < positions.length; i++) {
          const end = positions[i + 1] ?? text.length;
          const chunk = text.slice(positions[i], end).trim();
          if (chunk.length > 20) {
            chunks.push({
              index: index++,
              content: chunk,
              tokenCount: Math.ceil(chunk.length / charPerToken),
              type: 'legal',
              sectionTitle: chunk.split('\n')[0].slice(0, 50),
            });
          }
        }
        return chunks;
      }
    }

    // Estratégia padrão: tamanho fixo com overlap
    while (start < text.length) {
      const end = Math.min(start + chunkChars, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 20) {
        chunks.push({
          index: index++,
          content: chunk,
          tokenCount: Math.ceil(chunk.length / charPerToken),
          type: strategy,
        });
      }
      start += chunkChars - overlapChars;
    }

    return chunks;
  }
}
