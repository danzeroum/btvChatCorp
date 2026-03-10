import {
  Component, Input, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: RAGSource[];
  classification?: { level: string };
  isStreaming?: boolean;
}

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  sectionTitle?: string;
  snippet: string;
}

@Component({
  selector: 'app-message-display',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="message-wrapper" [class]="message.role">
      <div class="message-bubble">
        <!-- Avatar -->
        <div class="avatar">
          {{ message.role === 'user' ? '\uD83D\uDC64' : '\uD83E\uDD16' }}
        </div>

        <div class="message-body">
          <!-- Classificação de dados (visivel apenas para user messages) -->
          @if (message.role === 'user' && message.classification) {
            <span class="classification-tag" [class]="message.classification.level.toLowerCase()">
              {{ message.classification.level }}
            </span>
          }

          <!-- Conteúdo da mensagem -->
          <div class="message-content" [class.streaming]="message.isStreaming">
            <pre class="message-text">{{ message.content }}</pre>
            @if (message.isStreaming) {
              <span class="cursor-blink">|</span>
            }
          </div>

          <!-- Fontes RAG (apenas para assistant) -->
          @if (message.role === 'assistant' && message.sources?.length) {
            <div class="sources-section">
              <button class="sources-toggle" (click)="showSources = !showSources">
                \uD83D\uDCCB {{ message.sources!.length }} fonte(s) utilizada(s)
                {{ showSources ? '\u25B2' : '\u25BC' }}
              </button>
              @if (showSources) {
                <div class="sources-list">
                  @for (src of message.sources; track src.documentId + src.chunkIndex) {
                    <div class="source-item">
                      <span class="source-name">{{ src.documentName }}</span>
                      @if (src.sectionTitle) {
                        <span class="source-section">&#8250; {{ src.sectionTitle }}</span>
                      }
                      <span class="source-score">Score: {{ (src.score * 100).toFixed(0) }}%</span>
                      <p class="source-snippet">"{{ src.snippet }}"</p>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Timestamp -->
          <span class="message-time">
            {{ message.timestamp | date:'HH:mm' }}
          </span>

          <!-- Slot para feedback panel (projetado pelo pai) -->
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class MessageDisplayComponent {
  @Input({ required: true }) message!: ChatMessage;
  showSources = false;
}
