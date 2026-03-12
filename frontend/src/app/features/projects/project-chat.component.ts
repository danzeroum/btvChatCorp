import { Component, OnInit, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { DataFilterService } from '../../core/services/data-filter.service';
import { FeedbackCollectorService } from '../../core/services/feedback-collector.service';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
  timestamp: string;
  loading?: boolean;
  feedback?: 'positive' | 'negative' | null;
}

interface RagSource {
  documentName: string;
  sectionTitle: string | null;
  score: number;
  snippet: string;
}

@Component({
  selector: 'app-project-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="project-chat">

      <!-- Header -->
      <div class="chat-header">
        <div class="header-left">
          <button class="back-btn" [routerLink]="['/projects', projectId]">← {{ projectName() }}</button>
          <h2>{{ chatTitle() }}</h2>
        </div>
        <div class="header-right">
          <!-- Context badges -->
          <span class="context-badge" title="Documentos do projeto">📄 {{ docCount() }} docs</span>
          @if (activeInstruction()) {
            <span class="context-badge instruction" [title]="activeInstruction()!">📝 {{ activeInstruction() }}</span>
          }
        </div>
      </div>

      <!-- Messages -->
      <div class="messages-area" #scrollArea>
        @if (messages().length === 0 && !isStreaming()) {
          <div class="welcome-state">
            <span class="welcome-icon">{{ projectIcon() || '🤖' }}</span>
            <h3>{{ projectName() }}</h3>
            <p>Faça uma pergunta sobre os documentos deste projeto.</p>
            @if (suggestedQuestions.length > 0) {
              <div class="suggestions">
                @for (q of suggestedQuestions; track q) {
                  <button class="suggestion-chip" (click)="sendMessage(q)">{{ q }}</button>
                }
              </div>
            }
          </div>
        }

        @for (msg of messages(); track msg.id) {
          <div class="message" [class]="msg.role">
            <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : projectIcon() || '🤖' }}</div>
            <div class="msg-body">
              <div class="msg-content" [class.streaming]="msg.loading">
                {{ msg.content }}
                @if (msg.loading) { <span class="cursor">|</span> }
              </div>

              <!-- Sources -->
              @if (msg.role === 'assistant' && msg.sources?.length && !msg.loading) {
                <div class="msg-sources">
                  <button class="sources-toggle" (click)="msg._showSources = !msg._showSources">
                    📋 {{ msg.sources!.length }} fonte(s) {{ msg._showSources ? '▲' : '▼' }}
                  </button>
                  @if (msg._showSources) {
                    <div class="sources-list">
                      @for (src of msg.sources; track src.documentName + src.score) {
                        <div class="source-item">
                          <span class="source-name">{{ src.documentName }}</span>
                          @if (src.sectionTitle) {
                            <span class="source-section">› {{ src.sectionTitle }}</span>
                          }
                          <span class="source-score">{{ (src.score * 100).toFixed(0) }}%</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Feedback -->
              @if (msg.role === 'assistant' && !msg.loading) {
                <div class="msg-feedback">
                  <button class="fb-btn" [class.active]="msg.feedback === 'positive'"
                          (click)="giveFeedback(msg, 'positive')">👍</button>
                  <button class="fb-btn" [class.active]="msg.feedback === 'negative'"
                          (click)="giveFeedback(msg, 'negative')">👎</button>
                </div>
              }

              <span class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</span>
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="input-area">
        <textarea
          [(ngModel)]="inputText"
          (keydown.enter)="onEnter($event)"
          [disabled]="isStreaming()"
          [placeholder]="'Pergunte sobre ' + projectName() + '...'"
          rows="1"
          #inputEl></textarea>
        <button class="send-btn"
                (click)="sendMessage(inputText)"
                [disabled]="isStreaming() || !inputText.trim()">
          {{ isStreaming() ? '...' : '➤' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .project-chat { display: flex; flex-direction: column; height: 100%; }

    .chat-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px; border-bottom: 1px solid var(--color-border, #e2e8f0);
      background: var(--color-surface, #fff); flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .back-btn {
      background: none; border: none; color: var(--color-text-secondary, #888);
      cursor: pointer; font-size: 13px;
    }
    .chat-header h2 { font-size: 15px; font-weight: 600; margin: 0; }
    .header-right { display: flex; gap: 8px; }
    .context-badge {
      font-size: 11px; padding: 3px 10px; border-radius: 20px;
      background: var(--color-surface, #f1f5f9);
      border: 1px solid var(--color-border, #e2e8f0);
      color: var(--color-text-secondary, #666);
    }
    .context-badge.instruction { background: rgba(99,102,241,0.08); color: var(--color-primary, #6366f1); }

    /* Messages */
    .messages-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .welcome-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 60px 20px; flex: 1;
    }
    .welcome-icon { font-size: 48px; margin-bottom: 12px; }
    .welcome-state h3 { font-size: 18px; margin: 0 0 4px; }
    .welcome-state p { font-size: 14px; color: var(--color-text-secondary, #888); margin: 0 0 20px; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .suggestion-chip {
      padding: 8px 16px; border-radius: 20px; font-size: 13px;
      border: 1px solid var(--color-border, #d1d5db);
      background: var(--color-surface, #fff); cursor: pointer;
      color: var(--color-text-primary, #333);
      transition: border-color 0.12s;
    }
    .suggestion-chip:hover { border-color: var(--color-primary, #6366f1); color: var(--color-primary, #6366f1); }

    .message { display: flex; gap: 10px; max-width: 85%; }
    .message.user { align-self: flex-end; flex-direction: row-reverse; }
    .message.assistant { align-self: flex-start; }

    .msg-avatar { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
    .msg-body { display: flex; flex-direction: column; gap: 4px; }

    .msg-content {
      padding: 10px 14px; border-radius: 12px; font-size: 14px;
      line-height: 1.6; white-space: pre-wrap;
    }
    .message.user .msg-content {
      background: var(--color-primary, #6366f1); color: #fff;
      border-radius: 12px 4px 12px 12px;
    }
    .message.assistant .msg-content {
      background: var(--color-surface, #f8fafc);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 4px 12px 12px 12px;
      color: var(--color-text-primary, #333);
    }
    .cursor { animation: blink 0.8s infinite; }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

    /* Sources */
    .msg-sources { margin-top: 4px; }
    .sources-toggle {
      background: none; border: none; font-size: 12px;
      color: var(--color-primary, #6366f1); cursor: pointer;
    }
    .sources-list {
      margin-top: 6px; padding: 8px 12px;
      background: var(--color-background, #fafafa); border-radius: 8px;
      border: 1px solid var(--color-border, #e2e8f0);
    }
    .source-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; }
    .source-name { font-weight: 500; }
    .source-section { color: var(--color-text-secondary, #888); }
    .source-score { margin-left: auto; color: var(--color-text-secondary, #aaa); }

    /* Feedback */
    .msg-feedback { display: flex; gap: 4px; }
    .fb-btn {
      background: none; border: 1px solid transparent; cursor: pointer;
      font-size: 14px; padding: 2px 6px; border-radius: 6px; opacity: 0.4;
      transition: opacity 0.12s;
    }
    .fb-btn:hover { opacity: 0.8; }
    .fb-btn.active { opacity: 1; border-color: var(--color-border, #d1d5db); }

    .msg-time { font-size: 11px; color: var(--color-text-secondary, #aaa); }
    .message.user .msg-time { text-align: right; }

    /* Input */
    .input-area {
      display: flex; gap: 8px; padding: 12px 20px;
      border-top: 1px solid var(--color-border, #e2e8f0);
      background: var(--color-surface, #fff); align-items: flex-end;
    }
    textarea {
      flex: 1; padding: 10px 14px; border-radius: 10px;
      border: 1px solid var(--color-border, #d1d5db);
      font-size: 14px; resize: none; font-family: inherit;
      background: var(--color-background, #fafafa);
      color: var(--color-text-primary, #333);
      min-height: 20px; max-height: 120px;
    }
    textarea:focus { outline: none; border-color: var(--color-primary, #6366f1); }
    .send-btn {
      width: 40px; height: 40px; border-radius: 10px;
      background: var(--color-primary, #6366f1); color: #fff;
      border: none; cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  `]
})
export class ProjectChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollArea') scrollArea!: ElementRef;
  @ViewChild('inputEl') inputEl!: ElementRef;

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private wsCtx = inject(WorkspaceContextService);
  private dataFilter = inject(DataFilterService);
  private feedbackCollector = inject(FeedbackCollectorService);

  projectId = '';
  chatId = '';
  projectName = signal('Projeto');
  projectIcon = signal('📁');
  chatTitle = signal('Nova Conversa');
  docCount = signal(0);
  activeInstruction = signal<string | null>(null);

  messages = signal<(ChatMessage & { _showSources?: boolean })[]>([]);
  inputText = '';
  isStreaming = signal(false);

  suggestedQuestions = [
    'Resuma os principais pontos deste projeto',
    'Quais riscos foram identificados?',
    'Liste os documentos disponíveis',
  ];

  private shouldScroll = false;

  ngOnInit() {
    this.projectId = this.route.snapshot.params['id'];
    this.chatId = this.route.snapshot.params['chatId'];

    // Load project info
    const h = { 'X-Workspace-ID': this.wsCtx.workspaceId() };
    this.http.get<any>(`/api/v1/projects/${this.projectId}`, { headers: h }).subscribe(p => {
      this.projectName.set(p.name);
      this.projectIcon.set(p.icon || '📁');
    });
    this.http.get<any>(`/api/v1/projects/${this.projectId}/stats`, { headers: h }).subscribe(s => {
      this.docCount.set(s?.totalDocuments ?? 0);
    });

    // Pre-fill from query param
    const q = this.route.snapshot.queryParams['q'];
    if (q) {
      setTimeout(() => this.sendMessage(q), 300);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onEnter(event: KeyboardEvent) {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage(this.inputText);
    }
  }

  sendMessage(text: string) {
    const msg = (text || '').trim();
    if (!msg || this.isStreaming()) return;
    this.inputText = '';
    this.isStreaming.set(true);
    this.shouldScroll = true;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage & { _showSources?: boolean } = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date().toISOString(),
      loading: true,
    };

    this.messages.update(m => [...m, userMsg, assistantMsg]);

    // Build conversation history
    const history = this.messages()
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }));

    const token = localStorage.getItem('jwt_token');
    fetch('/api/v1/chat/completions/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Workspace-ID': this.wsCtx.workspaceId(),
      },
      body: JSON.stringify({
        messages: history,
        project_id: this.projectId,
        stream: true,
        include_sources: true,
      }),
    }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      const read = (): void => {
        reader.read().then(({ done, value }) => {
          if (done) {
            assistantMsg.loading = false;
            this.isStreaming.set(false);
            this.messages.update(m => [...m]); // trigger change detection
            return;
          }
          const text = decoder.decode(value);
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') {
              assistantMsg.loading = false;
              this.isStreaming.set(false);
              this.messages.update(m => [...m]);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                assistantMsg.content += parsed.choices[0].delta.content;
                this.shouldScroll = true;
                this.messages.update(m => [...m]);
              }
              if (parsed.sources) {
                assistantMsg.sources = parsed.sources;
              }
            } catch { /* skip */ }
          }
          read();
        });
      };
      read();
    }).catch(() => {
      assistantMsg.loading = false;
      assistantMsg.content = 'Erro ao gerar resposta. Tente novamente.';
      this.isStreaming.set(false);
      this.messages.update(m => [...m]);
    });
  }

  giveFeedback(msg: ChatMessage, rating: 'positive' | 'negative') {
    msg.feedback = msg.feedback === rating ? null : rating;
    this.feedbackCollector.addFeedback({
      interactionId: msg.id,
      rating: msg.feedback || 'positive',
      correction: null,
      category: '',
    });
  }

  private scrollToBottom() {
    try {
      const el = this.scrollArea?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}