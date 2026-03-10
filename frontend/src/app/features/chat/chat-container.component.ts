import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatStreamService } from '../../core/services/chat-stream.service';
import { DataFilterService } from '../../core/services/data-filter.service';
import { FeedbackCollectorService } from '../../core/services/feedback-collector.service';
import { WorkspaceContext } from '../../shared/models/data-classification.model';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  classification?: any;
  sources?: any[];
  timestamp: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-container">
      <div class="messages-area">
        @for (msg of messages; track msg.id) {
          <div [class]="'message ' + msg.role">
            <div class="message-content">{{ msg.content }}</div>

            @if (msg.role === 'assistant' && msg.sources?.length) {
              <div class="sources">
                <small>Fontes: {{ msg.sources?.length }} documentos</small>
              </div>
            }

            @if (msg.role === 'assistant') {
              <app-feedback-panel
                [messageId]="msg.id"
                (feedbackSubmitted)="onFeedback($event)">
              </app-feedback-panel>
            }
          </div>
        }

        @if (isStreaming) {
          <div class="message assistant streaming">
            <span class="typing-indicator">...</span>
          </div>
        }
      </div>

      <div class="input-area">
        <textarea
          [(ngModel)]="inputText"
          (keydown.enter)="onEnterKey($event)"
          placeholder="Digite sua mensagem..."
          rows="3">
        </textarea>
        <button (click)="sendMessage(inputText)" [disabled]="isStreaming">
          Enviar
        </button>
      </div>
    </div>
  `,
})
export class ChatContainerComponent {
  private chatStream = inject(ChatStreamService);
  private dataFilter = inject(DataFilterService);
  private feedbackCollector = inject(FeedbackCollectorService);

  messages: ChatMessage[] = [];
  inputText = '';
  isStreaming = false;
  workspace!: WorkspaceContext;

  onEnterKey(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage(this.inputText);
    }
  }

  sendMessage(rawText: string): void {
    if (!rawText.trim() || this.isStreaming) return;
    this.inputText = '';
    this.isStreaming = true;

    const filtered = this.dataFilter.processMessage(rawText, this.workspace);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: filtered.content,
      classification: filtered.classification,
      timestamp: filtered.timestamp,
    };
    this.messages.push(userMsg);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date().toISOString(),
    };
    this.messages.push(assistantMsg);

    this.chatStream.sendAndStream(filtered, this.workspace).subscribe({
      next: chunk => {
        if (chunk.type === 'token') {
          assistantMsg.content += chunk.data;
        } else if (chunk.type === 'sources') {
          assistantMsg.sources = chunk.data;
        }
      },
      complete: () => {
        this.isStreaming = false;
        this.feedbackCollector.recordInteraction({
          userMessage: filtered,
          assistantMessage: assistantMsg,
          context: this.workspace,
        });
      },
      error: () => {
        this.isStreaming = false;
        assistantMsg.content = 'Erro ao obter resposta. Tente novamente.';
      },
    });
  }

  onFeedback(event: any): void {
    this.feedbackCollector.addFeedback({
      interactionId: event.messageId,
      rating: event.rating,
      correction: event.correction,
      category: event.category,
      timestamp: new Date().toISOString(),
    });
  }
}
