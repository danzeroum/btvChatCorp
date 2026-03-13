import { Component, inject, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 1 | -1;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="chat-layout">

      <!-- Sidebar: chats recentes -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="logo">💬 Chat</span>
          <button class="new-btn" (click)="newChat()" title="Nova conversa">+</button>
        </div>

        <div class="chat-list">
          @for (c of recentChats(); track c.id) {
            <button class="chat-item" [class.active]="activeChatId() === c.id"
                    (click)="selectChat(c.id)">
              <span class="chat-item-title">{{ c.title || 'Nova conversa' }}</span>
              <span class="chat-item-date">{{ timeAgo(c.updated_at) }}</span>
            </button>
          }
          @if (recentChats().length === 0 && !loadingChats()) {
            <p class="no-chats">Nenhuma conversa ainda.</p>
          }
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/projects" class="nav-item">📁 Projetos</a>
          <a routerLink="/documents" class="nav-item">📄 Documentos</a>
          <a routerLink="/training"  class="nav-item">🧠 Treinamento</a>
          <a routerLink="/admin"     class="nav-item">⚙️ Admin</a>
        </nav>
      </aside>

      <!-- Área principal de chat -->
      <main class="chat-main">
        <header class="chat-header">
          <span class="chat-title">{{ currentTitle() }}</span>
          <span class="model-badge">Ollama</span>
        </header>

        <div class="messages-area" #msgArea>
          @if (messages().length === 0 && !sending()) {
            <div class="empty-state">
              <p>👋 Olá! Como posso ajudar?</p>
              <p class="empty-hint">Envie uma mensagem para começar.</p>
            </div>
          }

          @for (msg of messages(); track msg.id) {
            <div class="message" [class]="msg.role">
              <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
              <div class="msg-body">
                <div class="bubble">{{ msg.content }}</div>
                @if (msg.role === 'assistant') {
                  <div class="msg-actions">
                    <button (click)="sendFeedback(msg, 1)"
                            [class.active]="msg.feedback === 1">👍</button>
                    <button (click)="sendFeedback(msg, -1)"
                            [class.active]="msg.feedback === -1">👎</button>
                  </div>
                }
              </div>
            </div>
          }

          @if (sending()) {
            <div class="message assistant">
              <div class="avatar">🤖</div>
              <div class="msg-body">
                <div class="bubble thinking">
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="input-area">
          <textarea [(ngModel)]="inputText"
                    (keydown)="onKeydown($event)"
                    [disabled]="sending()"
                    placeholder="Mensagem... (Enter envia, Shift+Enter nova linha)"
                    rows="3"></textarea>
          <button (click)="send()" [disabled]="sending() || !inputText.trim()">
            {{ sending() ? '...' : 'Enviar' }}
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .chat-layout { display:flex; height:100vh; background:#0f0f0f; color:#f0f0f0; overflow:hidden; }

    /* Sidebar */
    .sidebar { width:240px; background:#111; border-right:1px solid #2a2a2a; display:flex; flex-direction:column; flex-shrink:0; overflow:hidden; }
    .sidebar-header { display:flex; justify-content:space-between; align-items:center; padding:16px 14px 12px; border-bottom:1px solid #2a2a2a; }
    .logo { font-size:0.95rem; font-weight:600; }
    .new-btn { background:#6366f1; color:#fff; border:none; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1.1rem; line-height:1; }
    .chat-list { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:2px; }
    .chat-item { background:none; border:none; text-align:left; padding:8px 10px; border-radius:8px; cursor:pointer; color:#ccc; width:100%; display:flex; flex-direction:column; gap:2px; transition:background 0.12s; }
    .chat-item:hover, .chat-item.active { background:#1e1e1e; color:#fff; }
    .chat-item-title { font-size:0.83rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chat-item-date { font-size:0.7rem; color:#666; }
    .no-chats { color:#555; font-size:0.8rem; padding:12px 10px; }
    .sidebar-nav { border-top:1px solid #2a2a2a; padding:8px; display:flex; flex-direction:column; gap:2px; }
    .nav-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; color:#888; text-decoration:none; font-size:0.85rem; transition:background 0.12s; }
    .nav-item:hover { background:#1e1e1e; color:#ddd; }

    /* Main */
    .chat-main { flex:1; display:flex; flex-direction:column; min-width:0; }
    .chat-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #2a2a2a; }
    .chat-title { font-size:0.95rem; font-weight:500; }
    .model-badge { font-size:0.72rem; background:#1e3a5f; color:#60a5fa; padding:3px 10px; border-radius:999px; }
    .messages-area { flex:1; overflow-y:auto; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#555; gap:8px; }
    .empty-hint { font-size:0.8rem; color:#444; }

    /* Mensagens */
    .message { display:flex; gap:10px; max-width:80%; }
    .message.user { align-self:flex-end; flex-direction:row-reverse; }
    .message.assistant { align-self:flex-start; }
    .avatar { font-size:1.2rem; flex-shrink:0; margin-top:2px; }
    .msg-body { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .bubble { padding:10px 14px; border-radius:14px; font-size:0.9rem; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
    .message.user .bubble { background:#2563eb; color:#fff; border-radius:14px 2px 14px 14px; }
    .message.assistant .bubble { background:#1e1e1e; border:1px solid #2a2a2a; border-radius:2px 14px 14px 14px; }
    .thinking { display:flex; gap:5px; align-items:center; padding:14px 18px; }
    .dot { width:7px; height:7px; background:#555; border-radius:50%; animation:bounce 1.2s infinite; }
    .dot:nth-child(2) { animation-delay:.2s; } .dot:nth-child(3) { animation-delay:.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    .msg-actions { display:flex; gap:6px; }
    .msg-actions button { background:none; border:none; cursor:pointer; font-size:0.85rem; opacity:0.4; transition:opacity 0.15s; padding:2px 4px; }
    .msg-actions button:hover, .msg-actions button.active { opacity:1; }

    /* Input */
    .input-area { padding:1rem 1.5rem; border-top:1px solid #2a2a2a; display:flex; gap:10px; align-items:flex-end; }
    textarea { flex:1; padding:10px 14px; border-radius:12px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:0.9rem; resize:none; font-family:inherit; line-height:1.5; }
    textarea:focus { outline:none; border-color:#2563eb; }
    textarea:disabled { opacity:0.5; }
    button { padding:10px 20px; border-radius:12px; background:#2563eb; color:#fff; border:none; cursor:pointer; font-size:0.9rem; font-weight:600; white-space:nowrap; }
    button:hover:not(:disabled) { background:#1d4ed8; }
    button:disabled { opacity:0.4; cursor:not-allowed; }
  `]
})
export class ChatContainerComponent implements OnInit, AfterViewChecked {
  @ViewChild('msgArea') private msgArea!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);

  messages      = signal<Message[]>([]);
  recentChats   = signal<ChatSummary[]>([]);
  activeChatId  = signal<string | null>(null);
  currentTitle  = signal('Nova conversa');
  sending       = signal(false);
  loadingChats  = signal(false);
  inputText     = '';
  private scrollNeeded = false;

  ngOnInit() { this.loadRecentChats(); }

  ngAfterViewChecked() {
    if (this.scrollNeeded) {
      this.scrollToBottom();
      this.scrollNeeded = false;
    }
  }

  /* ── sidebar ── */
  loadRecentChats() {
    this.loadingChats.set(true);
    this.http.get<ChatSummary[]>('/api/v1/chats').subscribe({
      next: chats => { this.recentChats.set(chats ?? []); this.loadingChats.set(false); },
      error: ()  => this.loadingChats.set(false),
    });
  }

  selectChat(id: string) {
    this.activeChatId.set(id);
    this.messages.set([]);
    const chat = this.recentChats().find(c => c.id === id);
    this.currentTitle.set(chat?.title || 'Conversa');

    this.http.get<Message[]>(`/api/v1/chats/${id}/messages`).subscribe({
      next: msgs => { this.messages.set(msgs ?? []); this.scrollNeeded = true; },
    });
  }

  newChat() {
    this.activeChatId.set(null);
    this.messages.set([]);
    this.currentTitle.set('Nova conversa');
  }

  /* ── envio de mensagem ── */
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  async send() {
    const text = this.inputText.trim();
    if (!text || this.sending()) return;
    this.inputText = '';
    this.sending.set(true);

    // Adiciona mensagem do usuário localmente
    const tempUserId = crypto.randomUUID();
    this.messages.update(m => [...m, {
      id: tempUserId, role: 'user', content: text,
      created_at: new Date().toISOString(),
    }]);
    this.scrollNeeded = true;

    // 1. Garante que existe um chat no banco
    let chatId = this.activeChatId();
    if (!chatId) {
      try {
        const newChat = await this.http
          .post<{ id: string; title: string }>('/api/v1/chats', { title: text.slice(0, 60) })
          .toPromise();
        chatId = newChat!.id;
        this.activeChatId.set(chatId);
        this.currentTitle.set(newChat!.title || text.slice(0, 40));
        this.recentChats.update(list => [newChat as ChatSummary, ...list]);
      } catch {
        this.sending.set(false);
        this.messages.update(m => [...m, {
          id: crypto.randomUUID(), role: 'assistant',
          content: 'Erro ao criar conversa. Tente novamente.',
          created_at: new Date().toISOString(),
        }]);
        return;
      }
    }

    // 2. Envia mensagem ao backend (POST /api/v1/chats/:id/messages)
    this.http.post<Message>(`/api/v1/chats/${chatId}/messages`, {
      content: text,
    }).subscribe({
      next: assistantMsg => {
        this.messages.update(m => [...m, assistantMsg]);
        this.sending.set(false);
        this.scrollNeeded = true;
        // Atualiza timestamp do chat na sidebar
        this.recentChats.update(list =>
          list.map(c => c.id === chatId
            ? { ...c, updated_at: new Date().toISOString() }
            : c
          )
        );
      },
      error: () => {
        this.messages.update(m => [...m, {
          id: crypto.randomUUID(), role: 'assistant',
          content: 'Erro ao obter resposta. Tente novamente.',
          created_at: new Date().toISOString(),
        }]);
        this.sending.set(false);
      },
    });
  }

  /* ── feedback ── */
  sendFeedback(msg: Message, value: 1 | -1) {
    if (msg.feedback === value) return;
    const chatId = this.activeChatId();
    if (!chatId) return;
    this.messages.update(msgs =>
      msgs.map(m => m.id === msg.id ? { ...m, feedback: value } : m)
    );
    this.http.post(`/api/v1/chats/${chatId}/messages/${msg.id}/feedback`, {
      feedback: value,
    }).subscribe();
  }

  /* ── helpers ── */
  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  private scrollToBottom() {
    try { this.msgArea.nativeElement.scrollTop = this.msgArea.nativeElement.scrollHeight; }
    catch { /* ignore */ }
  }
}
