import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../shared/models/message.model';
import { MarkdownRenderPipe } from '../../shared/pipes/markdown-render.pipe';
import { CopySanitizedDirective } from '../../shared/directives/copy-sanitized.directive';

@Component({
  selector: 'app-message-display',
  standalone: true,
  imports: [CommonModule, MarkdownRenderPipe, CopySanitizedDirective],
  template: `
    <div class="message" [class]="message.role" [appCopySanitized]="message.content">
      <div class="message-header">
        <span class="role-label">{{ message.role === 'user' ? 'Você' : 'Assistente' }}</span>
        <span class="timestamp">{{ message.timestamp | date:'HH:mm' }}</span>
        @if (message.classification) {
          <span class="badge classification">{{ message.classification }}</span>
        }
        @if (message.piiDetected) {
          <span class="badge pii-badge" title="PII anonimizado">🔒 PII</span>
        }
      </div>

      <div class="message-body">
        @if (message.isStreaming) {
          <span class="streaming-cursor">▌</span>
        }
        <div [innerHTML]="message.content | markdownRender"></div>
      </div>

      <!-- Fontes RAG -->
      @if (showSources && message.sources && message.sources.length > 0) {
        <div class="sources">
          <p class="sources-title">📄 Fontes utilizadas:</p>
          @for (source of message.sources; track source.chunkId) {
            <div class="source-item">
              <span class="doc-name">{{ source.documentName }}</span>
              @if (source.sectionTitle) {
                <span class="section">§ {{ source.sectionTitle }}</span>
              }
              <span class="score">{{ (source.similarityScore * 100).toFixed(0) }}%</span>
              <p class="excerpt">{{ source.excerpt }}</p>
            </div>
          }
        </div>
      }

      <!-- Slot para feedback-panel -->
      <ng-content></ng-content>
    </div>
  `
})
export class MessageDisplayComponent {
  @Input() message!: ChatMessage;
  @Input() showSources = false;
}
