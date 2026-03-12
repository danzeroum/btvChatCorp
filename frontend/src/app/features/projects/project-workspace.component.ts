import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface ProjectInstruction {
  id: string;
  name: string;
  content: string;
  trigger_mode: 'always' | 'manual';
  is_active: boolean;
}

export interface ProjectMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface ProjectDocument {
  id: string;
  filename: string;
  processing_status: string;
  chunks_count: number;
  size_bytes: number;
  linked_at: string;
}

export interface ProjectChat {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  is_pinned: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-project-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <div class="workspace">
      @if (loading()) {
        <div class="loading">Carregando projeto...</div>
      } @else if (project()) {

        <!-- Header do projeto -->
        <div class="ws-header">
          <div class="ws-title">
            <span class="proj-icon" [style.background]="project()!.color + '22'">{{ project()!.icon || '📁' }}</span>
            <div>
              <h1>{{ project()!.name }}</h1>
              <p>{{ project()!.description }}</p>
            </div>
          </div>
          <button class="btn-primary" (click)="newChat()">+ Novo Chat</button>
        </div>

        <!-- Tabs -->
        <div class="ws-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
              {{ tab.icon }} {{ tab.label }}
            </button>
          }
        </div>

        <div class="ws-body">

          <!-- Overview -->
          @if (activeTab() === 'overview') {
            <div class="overview-grid">
              <div class="stat-card">
                <div class="stat-value">{{ members().length }}</div>
                <div class="stat-label">Membros</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ chats().length }}</div>
                <div class="stat-label">Conversas</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ documents().length }}</div>
                <div class="stat-label">Documentos</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ activeInstructions().length }}</div>
                <div class="stat-label">Instruções ativas</div>
              </div>
            </div>

            <!-- Instruções ativas -->
            <div class="section">
              <div class="section-header">
                <h3>Instruções ativas</h3>
                <button class="link-btn" (click)="activeTab.set('instructions')">Gerenciar →</button>
              </div>
              @if (activeInstructions().length === 0) {
                <p class="empty-hint">Nenhuma instrução ativa.</p>
              } @else {
                @for (inst of activeInstructions(); track inst.id) {
                  <div class="inst-item">
                    <span>{{ inst.name }}</span>
                    <span class="inst-mode">{{ inst.trigger_mode === 'always' ? '🔁' : '👆' }}</span>
                  </div>
                }
              }
            </div>

            <!-- Membros -->
            <div class="section">
              <h3>Membros</h3>
              <div class="members-list">
                @for (m of members(); track m.user_id) {
                  <div class="member-item">
                    <span class="member-avatar">{{ m.name.slice(0,2) }}</span>
                    <span class="member-name">{{ m.name }}</span>
                    <span class="member-role">{{ m.role }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Chats -->
          @if (activeTab() === 'chats') {
            <div class="tab-toolbar">
              <input type="text" [(ngModel)]="chatSearch" placeholder="Buscar conversas..." class="search-input" />
              <button class="btn-primary" (click)="newChat()">+ Novo Chat</button>
            </div>
            @if (filteredChats().length === 0) {
              <div class="empty-state">
                <p>{{ chatSearch ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda. Crie uma!' }}</p>
              </div>
            } @else {
              <div class="chat-list">
                @for (chat of filteredChats(); track chat.id) {
                  <a [routerLink]="['/projects', project()!.id, 'chat', chat.id]" class="chat-item">
                    <div class="chat-info">
                      <h4>{{ chat.title || 'Conversa sem título' }}</h4>
                      @if (chat.is_pinned) { <span class="pin">📌</span> }
                    </div>
                    <div class="chat-meta">
                      <span>{{ chat.message_count }} mensagens</span>
                      <span>{{ timeAgo(chat.last_message_at) }}</span>
                    </div>
                  </a>
                }
              </div>
            }
          }

          <!-- Documentos -->
          @if (activeTab() === 'documents') {
            <div class="tab-toolbar">
              <h3>Documentos vinculados</h3>
              <button class="btn-secondary" (click)="uploadDocs()">📎 Adicionar Documentos</button>
            </div>
            @if (documents().length === 0) {
              <p class="empty-hint">Nenhum documento vinculado.</p>
            } @else {
              <table class="doc-table">
                <thead><tr><th>Arquivo</th><th>Status</th><th>Chunks</th><th>Tamanho</th><th>Adicionado</th></tr></thead>
                <tbody>
                  @for (doc of documents(); track doc.id) {
                    <tr>
                      <td class="doc-name-cell">{{ doc.filename }}</td>
                      <td><span class="status-badge" [class]="doc.processing_status">{{ doc.processing_status }}</span></td>
                      <td>{{ doc.chunks_count }}</td>
                      <td>{{ formatSize(doc.size_bytes) }}</td>
                      <td>{{ doc.linked_at | date:'dd/MM/yyyy' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }

          <!-- Instruções -->
          @if (activeTab() === 'instructions') {
            <div class="tab-toolbar">
              <h3>Instruções do Projeto</h3>
              <button class="btn-primary" (click)="addInstruction()">+ Nova Instrução</button>
            </div>
            @if (instructions().length === 0) {
              <p class="empty-hint">Nenhuma instrução cadastrada.</p>
            } @else {
              @for (inst of instructions(); track inst.id) {
                <div class="instruction-card" [class.inactive]="!inst.is_active">
                  <div class="inst-header">
                    <span class="inst-name">{{ inst.name }}</span>
                    <div class="inst-controls">
                      <span class="mode-badge">{{ inst.trigger_mode }}</span>
                      <span class="active-badge" [class.on]="inst.is_active">{{ inst.is_active ? 'Ativo' : 'Inativo' }}</span>
                    </div>
                  </div>
                  <p class="inst-content">{{ inst.content }}</p>
                </div>
              }
            }
          }

        </div>
      } @else {
        <div class="empty-state">Projeto não encontrado.</div>
      }
    </div>
  `,
  styles: [`
    .workspace { height: 100vh; overflow-y: auto; background: #0f0f0f; color: #f0f0f0; }
    .loading, .empty-state { text-align: center; padding: 4rem; color: #888; }
    .ws-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; border-bottom: 1px solid #2a2a2a; }
    .ws-title { display: flex; align-items: center; gap: 14px; }
    .proj-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
    .ws-title h1 { margin: 0 0 4px; font-size: 1.25rem; }
    .ws-title p { margin: 0; color: #888; font-size: 0.85rem; }
    .btn-primary { background: #6366f1; color: #fff; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn-secondary { background: #2a2a2a; color: #ccc; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; }
    .ws-tabs { display: flex; gap: 4px; padding: 0 2rem; border-bottom: 1px solid #2a2a2a; }
    .tab-btn { background: none; border: none; color: #888; padding: 12px 16px; cursor: pointer; font-size: 0.9rem; border-bottom: 2px solid transparent; transition: color 0.15s; }
    .tab-btn:hover { color: #ccc; }
    .tab-btn.active { color: #fff; border-bottom-color: #6366f1; }
    .ws-body { padding: 1.5rem 2rem; }
    .overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 10px; padding: 1.25rem; text-align: center; }
    .stat-value { font-size: 1.75rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #888; margin-top: 4px; }
    .section { margin-bottom: 2rem; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .section h3, .section-header h3 { margin: 0; font-size: 1rem; }
    .link-btn { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 0.85rem; }
    .empty-hint { color: #666; font-size: 0.85rem; }
    .inst-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #1e1e1e; border-radius: 6px; margin-bottom: 6px; font-size: 0.9rem; }
    .inst-mode { opacity: 0.6; }
    .members-list { display: flex; flex-direction: column; gap: 8px; }
    .member-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #1e1e1e; border-radius: 8px; }
    .member-avatar { width: 32px; height: 32px; border-radius: 8px; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .member-name { flex: 1; font-size: 0.9rem; }
    .member-role { font-size: 0.75rem; color: #888; }
    .tab-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .tab-toolbar h3 { margin: 0; font-size: 1rem; }
    .search-input { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 8px 14px; color: #f0f0f0; font-size: 0.85rem; }
    .chat-list { display: flex; flex-direction: column; gap: 8px; }
    .chat-item { display: block; padding: 12px 16px; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
    .chat-item:hover { border-color: #6366f1; }
    .chat-info { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .chat-info h4 { margin: 0; font-size: 0.9rem; }
    .chat-meta { display: flex; gap: 16px; font-size: 0.75rem; color: #888; }
    .pin { font-size: 0.8rem; }
    .doc-table { width: 100%; border-collapse: collapse; background: #1e1e1e; border-radius: 10px; overflow: hidden; border: 1px solid #2a2a2a; }
    .doc-table th { padding: 10px 14px; text-align: left; font-size: 0.8rem; color: #777; background: #161616; border-bottom: 1px solid #2a2a2a; }
    .doc-table td { padding: 10px 14px; font-size: 0.85rem; border-bottom: 1px solid #1a1a1a; }
    .doc-name-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; }
    .status-badge.completed { background: #22c55e22; color: #22c55e; }
    .status-badge.processing { background: #6366f122; color: #818cf8; }
    .status-badge.pending { background: #f59e0b22; color: #f59e0b; }
    .status-badge.failed { background: #ef444422; color: #ef4444; }
    .instruction-card { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 10px; padding: 1rem; margin-bottom: 10px; }
    .instruction-card.inactive { opacity: 0.5; }
    .inst-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .inst-name { font-weight: 500; font-size: 0.9rem; }
    .inst-controls { display: flex; gap: 8px; }
    .mode-badge { font-size: 0.75rem; background: #2a2a2a; padding: 2px 8px; border-radius: 10px; color: #aaa; }
    .active-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: #444; color: #888; }
    .active-badge.on { background: #22c55e22; color: #22c55e; }
    .inst-content { font-size: 0.85rem; color: #999; margin: 0; }
  `]
})
export class ProjectWorkspaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  loading = signal(true);
  project = signal<Project | null>(null);
  members = signal<ProjectMember[]>([]);
  chats = signal<ProjectChat[]>([]);
  documents = signal<ProjectDocument[]>([]);
  instructions = signal<ProjectInstruction[]>([]);
  activeTab = signal<string>('overview');
  chatSearch = '';

  // Filtros como computed — sem arrow functions no template
  activeInstructions = computed(() => this.instructions().filter(i => i.is_active));
  filteredChats = computed(() => {
    const q = this.chatSearch.toLowerCase();
    return q ? this.chats().filter(c => c.title?.toLowerCase().includes(q)) : this.chats();
  });

  tabs = [
    { id: 'overview', label: 'Visão Geral', icon: '🏠' },
    { id: 'chats', label: 'Chats', icon: '💬' },
    { id: 'documents', label: 'Documentos', icon: '📄' },
    { id: 'instructions', label: 'Instruções', icon: '📋' },
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadProject(id);
  }

  loadProject(id: string) {
    this.http.get<Project>(`/api/v1/projects/${id}`).subscribe({
      next: p => {
        this.project.set(p);
        this.loading.set(false);
        this.loadProjectData(id);
      },
      error: () => this.loading.set(false)
    });
  }

  loadProjectData(id: string) {
    this.http.get<{ members: ProjectMember[] }>(`/api/v1/projects/${id}/members`).subscribe(r => this.members.set(r.members));
    this.http.get<{ chats: ProjectChat[] }>(`/api/v1/projects/${id}/chats`).subscribe(r => this.chats.set(r.chats));
    this.http.get<{ documents: ProjectDocument[] }>(`/api/v1/projects/${id}/documents`).subscribe(r => this.documents.set(r.documents));
    this.http.get<{ instructions: ProjectInstruction[] }>(`/api/v1/projects/${id}/instructions`).subscribe(r => this.instructions.set(r.instructions));
  }

  newChat() {
    const pid = this.project()?.id;
    if (!pid) return;
    this.http.post<{ id: string }>(`/api/v1/projects/${pid}/chats`, { title: 'Nova Conversa' }).subscribe({
      next: res => window.location.href = `/projects/${pid}/chat/${res.id}`,
    });
  }

  uploadDocs() { window.location.href = '/documents'; }
  addInstruction() { /* TODO: modal */ }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}m atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  }

  formatSize(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
}
