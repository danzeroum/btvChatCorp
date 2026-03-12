import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FeedbackCollectorService } from '../../core/services/feedback-collector.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative';
}

@Component({
  selector: 'app-project-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="chat-page">
      <div class="chat-header">
        <a [routerLink]="['/projects', projectId()]">← Projeto</a>
        <span class="chat-title">{{ chatTitle() }}</span>
      </div>

      <div class="messages" #msgContainer>
        @for (msg of messages(); track msg.id) {
          <div class="message" [class]="msg.role">
            <div class="bubble">{{ msg.content }}</div>
            @if (msg.role === 'assistant') {
              <div class="msg-actions">
                <button (click)="sendFeedback(msg, 'positive')" [class.active]="msg.feedback === 'positive'">👍</button>
                <button (click)="sendFeedback(msg, 'negative')" [class.active]="msg.feedback === 'negative'">👎</button>
              </div>
            }
          </div>
        }
        @if (streaming()) {
          <div class="message assistant"><div class="bubble thinking">⏳ Pensando...</div></div>
        }
      </div>

      <div class="input-bar">
        <textarea [(ngModel)]="inputText"
                  placeholder="Mensagem..."
                  rows="1"
                  (keydown)="onKeydown($event)"></textarea>
        <button class="send-btn" [disabled]="!inputText.trim() || streaming()" (click)="sendMessage()">↑</button>
      </div>
    </div>
  `,
  styles: [`
    .chat-page { display: flex; flex-direction: column; height: 100vh; background: #0f0f0f; color: #f0f0f0; }
    .chat-header { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid #2a2a2a; }
    .chat-header a { color: #888; text-decoration: none; font-size: 0.85rem; }
    .chat-title { font-weight: 500; }
    .messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .message { display: flex; flex-direction: column; max-width: 75%; }
    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; }
    .bubble { padding: 12px 16px; border-radius: 14px; font-size: 0.9rem; line-height: 1.5; }
    .message.user .bubble { background: #6366f1; color: #fff; border-bottom-right-radius: 4px; }
    .message.assistant .bubble { background: #1e1e1e; border-bottom-left-radius: 4px; }
    .thinking { opacity: 0.6; font-style: italic; }
    .msg-actions { display: flex; gap: 8px; margin-top: 4px; }
    .msg-actions button { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.5; transition: opacity 0.15s; }
    .msg-actions button:hover, .msg-actions button.active { opacity: 1; }
    .input-bar { padding: 1rem 1.5rem; border-top: 1px solid #2a2a2a; display: flex; gap: 10px; align-items: flex-end; }
    textarea { flex: 1; background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 10px 14px; color: #f0f0f0; resize: none; font-size: 0.9rem; }
    .send-btn { background: #6366f1; color: #fff; border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; font-size: 1.1rem; }
    .send-btn:disabled { opacity: 0.4; cursor: default; }
  `]
})
export class ProjectChatComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private feedbackCollector = inject(FeedbackCollectorService);

  projectId = signal('');
  chatId = signal('');
  chatTitle = signal('Nova Conversa');
  messages = signal<Message[]>([]);
  inputText = '';
  streaming = signal(false);

  ngOnInit() {
    this.projectId.set(this.route.snapshot.paramMap.get('id') || '');
    this.chatId.set(this.route.snapshot.paramMap.get('chatId') || '');
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.streaming()) return;
    this.inputText = '';
    this.streaming.set(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    this.messages.update(m => [...m, userMsg]);

    this.http.post<{ answer: string; interaction_id: string }>('/api/v1/chat/complete', {
      message: text,
      project_id: this.projectId(),
      chat_id: this.chatId(),
    }).subscribe({
      next: res => {
        const assistantMsg: Message = { id: res.interaction_id || crypto.randomUUID(), role: 'assistant', content: res.answer, timestamp: new Date() };
        this.messages.update(m => [...m, assistantMsg]);
        this.streaming.set(false);
      },
      error: () => {
        const errMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: 'Erro ao obter resposta. Tente novamente.', timestamp: new Date() };
        this.messages.update(m => [...m, errMsg]);
        this.streaming.set(false);
      }
    });
  }

  sendFeedback(msg: Message, rating: 'positive' | 'negative') {
    msg.feedback = rating;
    this.feedbackCollector.addFeedback({
      interactionId: msg.id,
      rating,
      correction: null,
      category: 'general',
      timestamp: new Date().toISOString(),
    });
  }
}
