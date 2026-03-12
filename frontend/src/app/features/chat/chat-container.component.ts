import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  loading?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-layout">
      <aside class="sidebar">
        <div class="logo">BTV Chat Corp</div>
        <nav>
          <a href="/" class="nav-item active">💬 Chat</a>
          <a href="/documents" class="nav-item">📄 Documentos</a>
          <a href="/training" class="nav-item">🧠 Treinamento</a>
          <a href="/admin" class="nav-item">⚙️ Admin</a>
        </nav>
      </aside>

      <main class="chat-main">
        <header class="chat-header">
          <h2>Chat Corporativo</h2>
          <span class="model-badge">{{ modelLabel }}</span>
        </header>

        <div class="messages-area">
          <div *ngIf="messages.length === 0" class="empty-state">
            <p>👋 Olá! Como posso ajudar você hoje?</p>
          </div>

          @for (msg of messages; track msg.id) {
            <div [class]="'message ' + msg.role">
              <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
              <div class="message-body">
                <div class="message-content">{{ msg.loading ? '' : msg.content }}</div>
                @if (msg.loading) {
                  <div class="typing-indicator"><span></span><span></span><span></span></div>
                }
                @if (msg.role === 'assistant' && msg.sources?.length) {
                  <div class="sources">📎 {{ msg.sources?.length }} fonte(s) consultada(s)</div>
                }
                <div class="message-time">{{ msg.timestamp | date:'HH:mm' }}</div>
              </div>
            </div>
          }
        </div>

        <div class="input-area">
          <textarea
            [(ngModel)]="inputText"
            (keydown.enter)="onEnterKey($any($event))"
            [disabled]="isStreaming"
            placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
            rows="3">
          </textarea>
          <button (click)="sendMessage(inputText)" [disabled]="isStreaming || !inputText.trim()">
            {{ isStreaming ? '...' : 'Enviar' }}
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .chat-layout { display: flex; height: 100vh; background: #0f0f0f; color: #f0f0f0; }
    .sidebar { width: 220px; background: #161616; border-right: 1px solid #2a2a2a; display: flex; flex-direction: column; padding: 1.5rem 1rem; gap: 2rem; flex-shrink: 0; }
    .logo { font-size: 1rem; font-weight: 700; color: #fff; }
    nav { display: flex; flex-direction: column; gap: 0.25rem; }
    .nav-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; border-radius: 8px; color: #aaa; text-decoration: none; font-size: 0.9rem; transition: background 0.15s; }
    .nav-item:hover, .nav-item.active { background: #2a2a2a; color: #fff; }
    .chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .chat-header { padding: 1rem 1.5rem; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 1rem; }
    .chat-header h2 { font-size: 1rem; font-weight: 600; margin: 0; }
    .model-badge { font-size: 0.75rem; background: #1e3a5f; color: #60a5fa; padding: 0.2rem 0.6rem; border-radius: 999px; }
    .messages-area { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #555; font-size: 1rem; }
    .message { display: flex; gap: 0.75rem; max-width: 80%; }
    .message.user { align-self: flex-end; flex-direction: row-reverse; }
    .message.assistant { align-self: flex-start; }
    .message-avatar { font-size: 1.25rem; flex-shrink: 0; margin-top: 2px; }
    .message-body { display: flex; flex-direction: column; gap: 0.25rem; }
    .message-content { padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; min-height: 1rem; }
    .message.user .message-content { background: #2563eb; color: #fff; border-radius: 12px 2px 12px 12px; }
    .message.assistant .message-content { background: #1e1e1e; color: #e0e0e0; border-radius: 2px 12px 12px 12px; border: 1px solid #2a2a2a; }
    .sources { font-size: 0.75rem; color: #60a5fa; padding: 0.25rem; }
    .message-time { font-size: 0.7rem; color: #555; padding: 0 0.25rem; }
    .message.user .message-time { text-align: right; }
    .typing-indicator { display: flex; gap: 4px; padding: 0.75rem 1rem; background: #1e1e1e; border-radius: 12px; border: 1px solid #2a2a2a; width: fit-content; }
    .typing-indicator span { width: 6px; height: 6px; background: #555; border-radius: 50%; animation: bounce 1.2s infinite; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    .input-area { padding: 1rem 1.5rem; border-top: 1px solid #2a2a2a; display: flex; gap: 0.75rem; align-items: flex-end; }
    textarea { flex: 1; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid #333; background: #1a1a1a; color: #fff; font-size: 0.9rem; resize: none; font-family: inherit; line-height: 1.5; }
    textarea:focus { outline: none; border-color: #2563eb; }
    textarea:disabled { opacity: 0.5; }
    button { padding: 0.75rem 1.5rem; border-radius: 12px; background: #2563eb; color: #fff; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: background 0.15s; white-space: nowrap; }
    button:hover:not(:disabled) { background: #1d4ed8; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class ChatContainerComponent implements OnInit {
  private chatStream = inject(ChatStreamService);
  private dataFilter = inject(DataFilterService);
  private feedbackCollector = inject(FeedbackCollectorService);

  messages: ChatMessage[] = [];
  inputText = '';
  isStreaming = false;
  modelLabel = 'llama3.1:8b · Ollama';

  workspace: WorkspaceContext = {
    workspaceId: 'default',
    tenantId: 'default',
    allowedCollections: [],
    dataClassification: 'internal',
    retentionDays: 90,
    userId: 'anonymous',
    autoAnonymize: false,
    sensitiveKeywords: [],
  };

  ngOnInit() {}

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
      timestamp: new Date().toISOString(),
    };
    this.messages.push(userMsg);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date().toISOString(),
      loading: true,
    };
    this.messages.push(assistantMsg);

    this.chatStream.sendAndStream(filtered, this.workspace).subscribe({
      next: chunk => {
        assistantMsg.loading = false;
        if (chunk.type === 'token') {
          assistantMsg.content += chunk.data;
        } else if (chunk.type === 'sources') {
          assistantMsg.sources = chunk.data;
        }
      },
      complete: () => {
        this.isStreaming = false;
        assistantMsg.loading = false;
        this.feedbackCollector.recordInteraction({
          userMessage: filtered,
          assistantMessage: assistantMsg,
          context: this.workspace,
        });
      },
      error: () => {
        this.isStreaming = false;
        assistantMsg.loading = false;
        assistantMsg.content = 'Erro ao obter resposta. Tente novamente.';
      },
    });
  }
}
