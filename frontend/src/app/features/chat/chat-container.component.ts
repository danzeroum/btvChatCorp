import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { MarkdownRenderPipe } from '../../shared/pipes/markdown-render.pipe';
import { ChatStreamService } from '../../core/services/chat-stream.service';

interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
  project_id: string | null;
  project_name: string | null;
  is_pinned?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 1 | -1;
  tokens_used?: number;
}

interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

interface ModelItem {
  id: string;
  name: string;
  size_gb: number;
  is_default: boolean;
}

// Gera UUID sem depender de crypto.randomUUID (incompativel com HTTP)
function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MarkdownRenderPipe],
  template: `
    <div class="chat-layout">

      <!-- Sidebar: chats recentes -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="logo">💬 Chat</span>
          <button class="new-btn" (click)="newChat()" title="Nova conversa">+</button>
        </div>

        <div class="search-box">
          <input class="search-input" type="text"
                 [(ngModel)]="searchQuery" (input)="onSearch()"
                 placeholder="🔍 Buscar conversas...">
        </div>

        <div class="chat-list">
          @for (c of recentChats(); track c.id) {
            <div class="chat-row" [class.active]="activeChatId() === c.id">
              @if (renamingChatId() === c.id) {
                <div class="rename-form">
                  <input class="rename-input" [(ngModel)]="renameText"
                         (keydown.enter)="confirmRename(c.id)"
                         (keydown.escape)="cancelRename()" />
                  <button class="chat-action-btn confirm" title="Confirmar" (click)="confirmRename(c.id)">✓</button>
                  <button class="chat-action-btn" title="Cancelar" (click)="cancelRename()">✕</button>
                </div>
              } @else {
                <button class="chat-item" [class.active]="activeChatId() === c.id"
                        (click)="selectChat(c.id)">
                  <span class="chat-item-title">
                    @if (c.is_pinned) { <span class="pin-indicator">📌</span> }{{ c.title || 'Nova conversa' }}
                  </span>
                  @if (c.project_id) {
                    <a [routerLink]="['/projects', c.project_id]"
                       class="project-badge"
                       title="Ir para o projeto"
                       (click)="$event.stopPropagation()">
                      📁 {{ c.project_name || 'Projeto' }}
                    </a>
                  }
                  <span class="chat-item-date">{{ timeAgo(c.updated_at) }}</span>
                </button>
                <div class="chat-item-actions">
                  <button class="chat-action-btn" [class.pinned]="c.is_pinned"
                          [title]="c.is_pinned ? 'Desafixar' : 'Fixar no topo'"
                          (click)="togglePin(c); $event.stopPropagation()">📌</button>
                  <button class="chat-action-btn" title="Renomear" (click)="startRename(c); $event.stopPropagation()">✏️</button>
                  <button class="chat-action-btn" title="Excluir" (click)="deleteChat(c.id); $event.stopPropagation()">🗑️</button>
                </div>
              }
            </div>
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
          <div class="header-right">
            @if (totalTokens() > 0) {
              <span class="token-badge" title="Tokens estimados usados nesta conversa">~{{ totalTokens() }} tokens</span>
            }
            @if (messages().length > 0) {
              <button class="header-btn" (click)="exportConversation()" title="Exportar conversa (.txt)">⬇️ Exportar</button>
            }
            <span class="ollama-badge" [class]="ollamaStatus()"
                  [title]="'Ollama ' + ollamaStatus()">
              <span class="ollama-dot"></span>
              {{ ollamaStatus() === 'online' ? 'Ollama online' : ollamaStatus() === 'offline' ? 'Ollama offline' : 'Ollama' }}
            </span>
          </div>
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

                @if (msg.role === 'user' && editingMsgId() === msg.id) {
                  <!-- Inline edit form -->
                  <div class="edit-form">
                    <textarea class="edit-input" [(ngModel)]="editText" rows="2"
                              (keydown)="onEditKeydown($event, msg)"></textarea>
                    <div class="edit-actions">
                      <button class="action-btn" (click)="cancelEdit()">✕ Cancelar</button>
                      <button class="action-btn confirm" [disabled]="!editText.trim()"
                              (click)="confirmEdit(msg)">✓ Confirmar</button>
                    </div>
                  </div>
                } @else {
                  @if (msg.role === 'assistant') {
                    <div class="bubble markdown" [innerHTML]="msg.content | markdownRender"></div>
                  } @else {
                    <div class="bubble">{{ msg.content }}</div>
                  }
                  <div class="msg-hover-actions" [class.right]="msg.role === 'user'">
                    <button class="msg-action-btn" title="Copiar" (click)="copyMessage(msg)">
                      {{ copiedMsgId() === msg.id ? '✅' : '📋' }}
                    </button>
                    @if (msg.role === 'user') {
                      <button class="msg-action-btn" title="Editar" (click)="startEdit(msg)">✏️</button>
                      <button class="msg-action-btn danger" title="Apagar" (click)="deleteMessage(msg)">🗑️</button>
                    }
                    @if (msg.role === 'assistant') {
                      <button class="msg-action-btn" title="Reenviar" (click)="resendFromAssistant(msg)">🔄</button>
                      <button class="msg-action-btn" title="Positivo"
                              [class.active]="msg.feedback === 1"
                              (click)="sendFeedback(msg, 1)">👍</button>
                      <button class="msg-action-btn" title="Negativo"
                              [class.active]="msg.feedback === -1"
                              (click)="sendFeedback(msg, -1)">👎</button>
                    }
                  </div>
                }

              </div>
            </div>
          }

          @if (sending()) {
            <div class="message assistant">
              <div class="avatar">🤖</div>
              <div class="msg-body">
                @if (streamBuffer()) {
                  <div class="bubble streaming-bubble">{{ streamBuffer() }}<span class="cursor">▋</span></div>
                } @else {
                  <div class="bubble thinking">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="input-area">
          <input type="file" #fileInput multiple hidden
                 accept=".txt,.md,.csv,.pdf,.docx"
                 (change)="onFileSelected($event)" />
          @if (attachments().length > 0) {
            <div class="attachment-chips">
              @for (att of attachments(); track att.id) {
                <div class="chip">
                  <span class="chip-name" [title]="att.filename">📎 {{ att.filename }}</span>
                  <button class="chip-remove" type="button" (click)="removeAttachment(att.id)" title="Remover">✕</button>
                </div>
              }
            </div>
          }
          <div class="input-row">
            <button class="attach-btn" type="button"
                    (click)="fileInput.click()"
                    [disabled]="uploading() || sending()"
                    title="Anexar arquivo">
              {{ uploading() ? '⏳' : '📎' }}
            </button>
            <textarea [(ngModel)]="inputText"
                      (keydown)="onKeydown($event)"
                      [disabled]="sending()"
                      placeholder="Mensagem... (Enter envia, Shift+Enter nova linha)"
                      rows="3"></textarea>
            <button (click)="send()" [disabled]="sending() || !inputText.trim()">
              {{ sending() ? '...' : 'Enviar' }}
            </button>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .chat-layout { display:flex; height:100vh; background:#0f0f0f; color:#f0f0f0; overflow:hidden; }
    .sidebar { width:240px; background:#111; border-right:1px solid #2a2a2a; display:flex; flex-direction:column; flex-shrink:0; overflow:hidden; }
    .sidebar-header { display:flex; justify-content:space-between; align-items:center; padding:16px 14px 12px; border-bottom:1px solid #2a2a2a; }
    .logo { font-size:0.95rem; font-weight:600; }
    .new-btn { background:#6366f1; color:#fff; border:none; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:1.1rem; line-height:1; }
    .chat-list { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:2px; }
    .chat-row { position:relative; display:flex; align-items:center; border-radius:8px; }
    .chat-row:hover .chat-item-actions { opacity:1; }
    .chat-row.active .chat-item-actions { opacity:1; }
    .chat-item { background:none; border:none; text-align:left; padding:8px 10px; border-radius:8px; cursor:pointer; color:#ccc; flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; transition:background 0.12s; }
    .chat-item:hover, .chat-item.active { background:#1e1e1e; color:#fff; }
    .chat-item-title { font-size:0.83rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chat-item-date { font-size:0.7rem; color:#666; }
    .project-badge { font-size:0.68rem; color:#818cf8; text-decoration:none; padding:1px 6px; background:#6366f115; border-radius:4px; display:inline-flex; align-items:center; gap:3px; width:fit-content; }
    .project-badge:hover { background:#6366f130; }
    .chat-item-actions { display:flex; gap:2px; opacity:0; transition:opacity 0.15s; flex-shrink:0; padding-right:4px; }
    .chat-action-btn { background:none; border:none; cursor:pointer; padding:3px 5px; font-size:0.8rem; border-radius:4px; color:#888; line-height:1; }
    .chat-action-btn:hover { background:#2a2a2a; color:#fff; }
    .chat-action-btn.confirm { color:#22c55e; }
    .chat-action-btn.confirm:hover { background:#22c55e22; }
    .rename-form { display:flex; align-items:center; gap:4px; padding:4px 6px; flex:1; min-width:0; }
    .rename-input { flex:1; min-width:0; background:#1a1a1a; border:1px solid #555; border-radius:6px; color:#fff; font-size:0.8rem; padding:5px 8px; }
    .rename-input:focus { outline:none; border-color:#6366f1; }
    .no-chats { color:#555; font-size:0.8rem; padding:12px 10px; }
    .sidebar-nav { border-top:1px solid #2a2a2a; padding:8px; display:flex; flex-direction:column; gap:2px; }
    .nav-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; color:#888; text-decoration:none; font-size:0.85rem; transition:background 0.12s; }
    .nav-item:hover { background:#1e1e1e; color:#ddd; }
    .chat-main { flex:1; display:flex; flex-direction:column; min-width:0; }
    .chat-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #2a2a2a; }
    .chat-title { font-size:0.95rem; font-weight:500; }
    .header-right { display:flex; align-items:center; gap:10px; }
    .token-badge { font-size:0.7rem; color:#888; background:#1a1a1a; border:1px solid #2a2a2a; padding:3px 8px; border-radius:999px; }
    .header-btn { padding:5px 10px; border-radius:8px; background:#1e1e1e; border:1px solid #333; color:#aaa; cursor:pointer; font-size:0.75rem; font-weight:500; }
    .header-btn:hover { background:#2a2a2a; color:#fff; }
    .model-badge { font-size:0.72rem; background:#1e3a5f; color:#60a5fa; padding:3px 10px; border-radius:999px; }
    .search-box { padding:8px 10px 4px; }
    .search-input { width:100%; box-sizing:border-box; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:8px; color:#ddd; font-size:0.8rem; padding:7px 10px; }
    .search-input:focus { outline:none; border-color:#6366f1; }
    .search-input::placeholder { color:#666; }
    .ollama-badge { display:inline-flex; align-items:center; gap:6px; font-size:0.72rem; padding:3px 10px; border-radius:999px; background:#1a1a1a; border:1px solid #2a2a2a; color:#999; }
    .ollama-badge .ollama-dot { width:7px; height:7px; border-radius:50%; background:#666; }
    .ollama-badge.online { color:#4ade80; border-color:#22c55e44; }
    .ollama-badge.online .ollama-dot { background:#22c55e; }
    .ollama-badge.offline { color:#f87171; border-color:#ef444444; }
    .ollama-badge.offline .ollama-dot { background:#ef4444; }
    .pin-indicator { margin-right:3px; }
    .chat-action-btn.pinned { color:#f59e0b; opacity:1; }
    .messages-area { flex:1; overflow-y:auto; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#555; gap:8px; }
    .empty-hint { font-size:0.8rem; color:#444; }
    .message { display:flex; gap:10px; max-width:80%; }
    .message.user { align-self:flex-end; flex-direction:row-reverse; }
    .message.assistant { align-self:flex-start; }
    .avatar { font-size:1.2rem; flex-shrink:0; margin-top:2px; }
    .msg-body { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .bubble { padding:10px 14px; border-radius:14px; font-size:0.9rem; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
    .message.user .bubble { background:#2563eb; color:#fff; border-radius:14px 2px 14px 14px; }
    .message.assistant .bubble { background:#1e1e1e; border:1px solid #2a2a2a; border-radius:2px 14px 14px 14px; }
    .streaming-bubble { background:#1e1e1e; border:1px solid #2a2a2a; border-radius:2px 14px 14px 14px; white-space:pre-wrap; word-break:break-word; }
    .cursor { display:inline-block; animation:blink 1s step-end infinite; color:#60a5fa; margin-left:1px; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    /* Markdown rendering dentro das bolhas do assistente */
    .bubble.markdown :first-child { margin-top:0; }
    .bubble.markdown :last-child { margin-bottom:0; }
    .bubble.markdown p { margin:0 0 0.6em; }
    .bubble.markdown h1, .bubble.markdown h2, .bubble.markdown h3 { margin:0.6em 0 0.3em; line-height:1.3; }
    .bubble.markdown h1 { font-size:1.15rem; } .bubble.markdown h2 { font-size:1.05rem; } .bubble.markdown h3 { font-size:0.98rem; }
    .bubble.markdown ul { margin:0.3em 0; padding-left:1.3em; }
    .bubble.markdown li { margin:0.15em 0; }
    .bubble.markdown a { color:#60a5fa; }
    .bubble.markdown code { background:#0d0d0d; border:1px solid #2a2a2a; border-radius:4px; padding:1px 5px; font-family:'SFMono-Regular',Consolas,monospace; font-size:0.85em; }
    .bubble.markdown pre { background:#0d0d0d; border:1px solid #2a2a2a; border-radius:8px; padding:12px 14px; overflow-x:auto; margin:0.5em 0; }
    .bubble.markdown pre code { background:none; border:none; padding:0; display:block; line-height:1.5; white-space:pre; }
    .thinking { display:flex; gap:5px; align-items:center; padding:14px 18px; }
    .dot { width:7px; height:7px; background:#555; border-radius:50%; animation:bounce 1.2s infinite; }
    .dot:nth-child(2) { animation-delay:.2s; } .dot:nth-child(3) { animation-delay:.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    /* Per-message hover actions */
    .msg-hover-actions { display:flex; gap:3px; opacity:0; transition:opacity 0.15s; }
    .msg-hover-actions.right { justify-content:flex-end; }
    .message:hover .msg-hover-actions { opacity:1; }
    .msg-action-btn { background:none; border:none; cursor:pointer; font-size:0.8rem; padding:2px 5px; border-radius:4px; color:#888; line-height:1; }
    .msg-action-btn:hover { background:#2a2a2a; color:#ccc; }
    .msg-action-btn.active { color:#22c55e; opacity:1; }
    .msg-action-btn.danger:hover { background:#ef444422; color:#ef4444; }
    /* Inline edit form */
    .edit-form { display:flex; flex-direction:column; gap:6px; }
    .edit-input { background:#1e1e1e; border:1px solid #6366f1; border-radius:10px; padding:8px 12px; color:#fff; font-size:0.9rem; resize:none; font-family:inherit; line-height:1.5; min-width:200px; }
    .edit-input:focus { outline:none; }
    .edit-actions { display:flex; gap:6px; justify-content:flex-end; }
    .action-btn { padding:4px 10px; border-radius:6px; border:1px solid #444; background:none; color:#aaa; cursor:pointer; font-size:0.78rem; }
    .action-btn:hover { background:#2a2a2a; }
    .action-btn.confirm { border-color:#22c55e; color:#22c55e; }
    .action-btn.confirm:hover { background:#22c55e22; }
    .action-btn:disabled { opacity:0.4; cursor:not-allowed; }
    /* Input area */
    .input-area { padding:1rem 1.5rem; border-top:1px solid #2a2a2a; display:flex; flex-direction:column; gap:8px; }
    .input-row { display:flex; gap:10px; align-items:flex-end; }
    textarea { flex:1; padding:10px 14px; border-radius:12px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:0.9rem; resize:none; font-family:inherit; line-height:1.5; }
    textarea:focus { outline:none; border-color:#2563eb; }
    textarea:disabled { opacity:0.5; }
    button { padding:10px 20px; border-radius:12px; background:#2563eb; color:#fff; border:none; cursor:pointer; font-size:0.9rem; font-weight:600; white-space:nowrap; }
    button:hover:not(:disabled) { background:#1d4ed8; }
    button:disabled { opacity:0.4; cursor:not-allowed; }
    /* Attach button */
    .attach-btn { padding:0; width:40px; height:40px; background:#1e1e1e; border:1px solid #333; border-radius:10px; font-size:1.05rem; flex-shrink:0; color:#888; }
    .attach-btn:hover:not(:disabled) { background:#2a2a2a; border-color:#555; color:#fff; }
    /* Attachment chips */
    .attachment-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { display:flex; align-items:center; gap:4px; background:#1e3a5f; color:#93c5fd; border-radius:8px; padding:4px 10px; font-size:0.78rem; max-width:220px; }
    .chip-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
    .chip-remove { background:none; border:none; cursor:pointer; color:#93c5fd; font-size:0.7rem; line-height:1; padding:0 0 0 2px; flex-shrink:0; }
    .chip-remove:hover { color:#fff; }
  `]
})
export class ChatContainerComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('msgArea') private msgArea!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private chatStream = inject(ChatStreamService);

  messages     = signal<Message[]>([]);
  recentChats  = signal<ChatSummary[]>([]);
  activeChatId = signal<string | null>(null);
  currentTitle = signal('Nova conversa');
  sending      = signal(false);
  loadingChats = signal(false);
  inputText    = '';

  // Streaming (SSE) da resposta do assistente
  streamBuffer = signal('');

  // Total estimado de tokens da conversa (soma de tokens_used das mensagens)
  totalTokens = computed(() =>
    this.messages().reduce((sum, m) => sum + (m.tokens_used ?? 0), 0)
  );

  // Sidebar rename
  renamingChatId = signal<string | null>(null);
  renameText     = '';

  // Message edit / copy
  editingMsgId = signal<string | null>(null);
  editText     = '';
  copiedMsgId  = signal<string | null>(null);

  // File attachments
  attachments = signal<Attachment[]>([]);
  uploading   = signal(false);

  // Model selection
  availableModels = signal<ModelItem[]>([]);
  selectedModel   = signal<string>('');

  // Busca no histórico (debounced)
  searchQuery = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Status do Ollama (polling)
  ollamaStatus = signal<'online' | 'offline' | 'unknown'>('unknown');
  private ollamaTimer: ReturnType<typeof setInterval> | null = null;

  private scrollNeeded = false;

  ngOnInit() {
    this.loadRecentChats();
    const saved = localStorage.getItem('btv_selected_model');
    if (saved) this.selectedModel.set(saved);
    this.http.get<{ models: ModelItem[]; default_model: string }>('/api/v1/models').subscribe({
      next: ({ models, default_model }) => {
        this.availableModels.set(models);
        if (!this.selectedModel()) this.selectedModel.set(default_model);
      },
    });
    this.checkOllama();
    this.ollamaTimer = setInterval(() => this.checkOllama(), 30_000);
  }

  ngOnDestroy() {
    if (this.ollamaTimer) clearInterval(this.ollamaTimer);
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  ngAfterViewChecked() {
    if (this.scrollNeeded) { this.scrollToBottom(); this.scrollNeeded = false; }
  }

  checkOllama() {
    this.http.get<{ status: string }>('/api/v1/health/ollama').subscribe({
      next: r => this.ollamaStatus.set(r.status === 'online' ? 'online' : 'offline'),
      error: () => this.ollamaStatus.set('offline'),
    });
  }

  loadRecentChats(q?: string) {
    this.loadingChats.set(true);
    const url = q && q.trim() ? `/api/v1/chats?q=${encodeURIComponent(q.trim())}` : '/api/v1/chats';
    this.http.get<ChatSummary[]>(url).subscribe({
      next: chats => { this.recentChats.set(this.sortChats(chats ?? [])); this.loadingChats.set(false); },
      error: () => this.loadingChats.set(false),
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadRecentChats(this.searchQuery), 300);
  }

  /** Fixados primeiro, depois por data de atualização (espelha o ORDER BY do backend). */
  private sortChats(list: ChatSummary[]): ChatSummary[] {
    return [...list].sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  selectChat(id: string) {
    this.activeChatId.set(id);
    this.messages.set([]);
    this.attachments.set([]);
    this.cancelEdit();
    const chat = this.recentChats().find(c => c.id === id);
    this.currentTitle.set(chat?.title || 'Conversa');
    this.http.get<Message[]>(`/api/v1/chats/${id}/messages`).subscribe({
      next: msgs => { this.messages.set(msgs ?? []); this.scrollNeeded = true; },
    });
  }

  newChat() {
    this.activeChatId.set(null);
    this.messages.set([]);
    this.attachments.set([]);
    this.currentTitle.set('Nova conversa');
    this.cancelEdit();
    this.cancelRename();
  }

  onModelChange(modelId: string) {
    this.selectedModel.set(modelId);
    localStorage.setItem('btv_selected_model', modelId);
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  // ── Sidebar rename / delete ──

  startRename(c: ChatSummary) {
    this.renameText = c.title || '';
    this.renamingChatId.set(c.id);
  }

  cancelRename() {
    this.renamingChatId.set(null);
    this.renameText = '';
  }

  confirmRename(id: string) {
    const title = this.renameText.trim();
    if (!title) { this.cancelRename(); return; }
    this.http.patch<ChatSummary>(`/api/v1/chats/${id}`, { title }).subscribe({
      next: updated => {
        this.recentChats.update(list =>
          list.map(c => c.id === id ? { ...c, title: updated.title } : c)
        );
        if (this.activeChatId() === id) this.currentTitle.set(updated.title);
        this.cancelRename();
      },
      error: () => this.cancelRename(),
    });
  }

  deleteChat(id: string) {
    if (!confirm('Excluir esta conversa?')) return;
    this.http.delete(`/api/v1/chats/${id}`).subscribe({
      next: () => {
        this.recentChats.update(list => list.filter(c => c.id !== id));
        if (this.activeChatId() === id) {
          this.activeChatId.set(null);
          this.messages.set([]);
          this.currentTitle.set('Nova conversa');
        }
      },
    });
  }

  // ── Pin / desafixar ──

  togglePin(c: ChatSummary) {
    const next = !c.is_pinned;
    this.http.patch<ChatSummary>(`/api/v1/chats/${c.id}`, { is_pinned: next }).subscribe({
      next: () => {
        this.recentChats.update(list =>
          this.sortChats(list.map(x => x.id === c.id ? { ...x, is_pinned: next } : x))
        );
      },
    });
  }

  // ── Export da conversa (.txt) — sem chamada nova ao backend ──

  exportConversation() {
    const msgs = this.messages();
    if (msgs.length === 0) return;
    const title = this.currentTitle() || 'conversa';
    const body = msgs.map(m => {
      const who = m.role === 'user' ? 'Usuário' : 'Assistente';
      const when = m.created_at ? new Date(m.created_at).toLocaleString() : '';
      return `### ${who}${when ? ' — ' + when : ''}\n${m.content}\n`;
    }).join('\n');
    const content = `# ${title}\nExportado em ${new Date().toLocaleString()}\n\n${body}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title.replace(/[^\w\-]+/g, '_').slice(0, 60)) || 'conversa'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Per-message actions ──

  copyMessage(msg: Message) {
    navigator.clipboard.writeText(msg.content).then(() => {
      this.copiedMsgId.set(msg.id);
      setTimeout(() => this.copiedMsgId.set(null), 2000);
    });
  }

  startEdit(msg: Message) {
    this.editingMsgId.set(msg.id);
    this.editText = msg.content;
  }

  cancelEdit() {
    this.editingMsgId.set(null);
    this.editText = '';
  }

  onEditKeydown(event: KeyboardEvent, msg: Message) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.confirmEdit(msg);
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  async confirmEdit(msg: Message) {
    const text = this.editText.trim();
    if (!text) { this.cancelEdit(); return; }
    const chatId = this.activeChatId();
    if (!chatId) { this.cancelEdit(); return; }

    const msgs = this.messages();
    const idx = msgs.findIndex(m => m.id === msg.id);
    const nextMsg = idx >= 0 && idx < msgs.length - 1 ? msgs[idx + 1] : null;

    await firstValueFrom(
      this.http.delete(`/api/v1/chats/${chatId}/messages/${msg.id}`).pipe(timeout(5000))
    ).catch(() => {});
    if (nextMsg?.role === 'assistant') {
      await firstValueFrom(
        this.http.delete(`/api/v1/chats/${chatId}/messages/${nextMsg.id}`).pipe(timeout(5000))
      ).catch(() => {});
    }

    const remove = new Set([msg.id, ...(nextMsg?.role === 'assistant' ? [nextMsg.id] : [])]);
    this.messages.update(list => list.filter(m => !remove.has(m.id)));
    this.cancelEdit();
    this.inputText = text;
    this.send();
  }

  deleteMessage(msg: Message) {
    if (!confirm('Remover esta mensagem?')) return;
    const chatId = this.activeChatId();
    if (!chatId) return;
    this.http.delete(`/api/v1/chats/${chatId}/messages/${msg.id}`).subscribe({
      next: () => this.messages.update(list => list.filter(m => m.id !== msg.id)),
    });
  }

  async resendFromAssistant(msg: Message) {
    const chatId = this.activeChatId();
    if (!chatId) return;
    const msgs = this.messages();
    const idx = msgs.findIndex(m => m.id === msg.id);
    const prevMsg = idx > 0 ? msgs[idx - 1] : null;
    if (!prevMsg || prevMsg.role !== 'user') return;

    await firstValueFrom(
      this.http.delete(`/api/v1/chats/${chatId}/messages/${msg.id}`).pipe(timeout(5000))
    ).catch(() => {});
    await firstValueFrom(
      this.http.delete(`/api/v1/chats/${chatId}/messages/${prevMsg.id}`).pipe(timeout(5000))
    ).catch(() => {});

    this.messages.update(list => list.filter(m => m.id !== msg.id && m.id !== prevMsg.id));
    this.inputText = prevMsg.content;
    this.send();
  }

  // ── File attachments ──

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const chatId = this.activeChatId();
    if (!chatId) {
      alert('Selecione ou inicie uma conversa antes de anexar arquivos.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      try {
        const att = await firstValueFrom(
          this.http.post<Attachment>(`/api/v1/chats/${chatId}/attachments`, form)
        );
        this.attachments.update(list => [...list, att]);
      } catch {
        console.error('Erro ao enviar arquivo:', file.name);
      }
    }
    this.uploading.set(false);
    input.value = '';
  }

  removeAttachment(id: string) {
    const chatId = this.activeChatId();
    if (!chatId) return;
    this.http.delete(`/api/v1/chats/${chatId}/attachments/${id}`).subscribe({
      next: () => this.attachments.update(list => list.filter(a => a.id !== id)),
    });
  }

  // ── Send message ──

  async send() {
    const text = this.inputText.trim();
    if (!text || this.sending()) return;
    this.inputText = '';
    this.sending.set(true);

    this.messages.update(m => [...m, {
      id: genId(), role: 'user' as const, content: text,
      created_at: new Date().toISOString(),
    }]);
    this.scrollNeeded = true;

    let chatId = this.activeChatId();
    const wasNewChat = !chatId;
    if (!chatId) {
      try {
        // Cria sem título: o backend assume 'Nova conversa', permitindo que o
        // título automático (gerado pelo LLM) dispare. Exibimos um rótulo
        // otimista (trecho da mensagem) só na UI até o título real chegar.
        const newChat = await firstValueFrom(
          this.http.post<{ id: string; title: string }>('/api/v1/chats', {})
        );
        chatId = newChat!.id;
        this.activeChatId.set(chatId);
        const optimistic = text.slice(0, 40);
        this.currentTitle.set(optimistic);
        this.recentChats.update(list => [{ ...(newChat as ChatSummary), title: optimistic }, ...list]);
      } catch {
        this.sending.set(false);
        this.messages.update(m => [...m, {
          id: genId(), role: 'assistant' as const,
          content: 'Erro ao criar conversa. Tente novamente.',
          created_at: new Date().toISOString(),
        }]);
        return;
      }
    }

    // Consome a resposta via SSE (POST /chat/stream) para exibir tokens em
    // tempo real. O chat já foi criado acima, então sempre enviamos chat_id —
    // o backend não devolve um id novo no stream.
    this.streamBuffer.set('');
    this.chatStream.sendAndStream({ message: text, chat_id: chatId }).subscribe({
      next: chunk => {
        if (chunk.type === 'token' && typeof chunk.data === 'string') {
          this.streamBuffer.update(b => b + chunk.data);
          this.scrollNeeded = true;
        }
      },
      error: () => {
        this.messages.update(m => [...m, {
          id: genId(), role: 'assistant' as const,
          content: 'Erro ao obter resposta. Tente novamente.',
          created_at: new Date().toISOString(),
        }]);
        this.streamBuffer.set('');
        this.sending.set(false);
      },
      complete: () => {
        const content = this.streamBuffer().trim();
        if (content) {
          this.messages.update(m => [...m, {
            id: genId(), role: 'assistant' as const, content,
            created_at: new Date().toISOString(),
          }]);
        }
        this.streamBuffer.set('');
        this.sending.set(false);
        this.scrollNeeded = true;
        this.recentChats.update(list =>
          this.sortChats(list.map(c => c.id === chatId
            ? { ...c, updated_at: new Date().toISOString() } : c
          ))
        );
        // Na 1ª troca, o backend gera o título de forma assíncrona — busca leve
        // (só este chat) para refletir o título gerado quando ficar pronto.
        if (wasNewChat && chatId) this.refreshTitle(chatId);
      },
    });
  }

  /** Busca leve do título gerado pelo backend (apenas este chat). Só faz upgrade:
   *  nunca rebaixa para 'Nova conversa' caso o LLM ainda esteja gerando. */
  private refreshTitle(chatId: string, attempt = 0) {
    setTimeout(() => {
      this.http.get<{ title: string }>(`/api/v1/chats/${chatId}`).subscribe({
        next: chat => {
          const t = chat?.title?.trim();
          if (t && t !== 'Nova conversa') {
            this.recentChats.update(list => list.map(c => c.id === chatId ? { ...c, title: t } : c));
            if (this.activeChatId() === chatId) this.currentTitle.set(t);
          } else if (attempt < 1) {
            this.refreshTitle(chatId, attempt + 1); // LLM ainda gerando — tenta de novo
          }
        },
      });
    }, attempt === 0 ? 1500 : 3000);
  }

  sendFeedback(msg: Message, value: 1 | -1) {
    if (msg.feedback === value) return;
    const chatId = this.activeChatId();
    if (!chatId) return;
    this.messages.update(msgs =>
      msgs.map(m => m.id === msg.id ? { ...m, feedback: value } : m)
    );
    this.http.post(`/api/v1/chats/${chatId}/messages/${msg.id}/feedback`, { feedback: value }).subscribe();
  }

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
