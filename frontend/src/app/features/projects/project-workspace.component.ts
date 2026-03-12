import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

interface Project {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: string;
  category: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface ProjectDocument {
  id: string;
  document_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  processing_status: string;
  chunks_count: number;
  linked_at: string;
}

interface ProjectChat {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  is_pinned: boolean;
}

interface ProjectInstruction {
  id: string;
  name: string;
  description: string | null;
  content: string;
  trigger_mode: string;
  is_active: boolean;
}

interface ProjectMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-project-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (loading()) {
      <div class="loading-page">Carregando projeto...</div>
    } @else if (project()) {
      <div class="workspace">

        <!-- Header -->
        <div class="ws-header">
          <div class="ws-identity">
            <button class="back-link" routerLink="/projects">← Projetos</button>
            <span class="ws-icon"
                  [style.background]="(project()!.color || '#6366f1') + '18'"
                  [style.color]="project()!.color || '#6366f1'">
              {{ project()!.icon || '📁' }}
            </span>
            <div>
              <h1>{{ project()!.name }}</h1>
              @if (project()!.description) {
                <p class="ws-desc">{{ project()!.description }}</p>
              }
            </div>
          </div>
          <div class="ws-actions">
            <button class="btn-primary" (click)="newChat()">💬 Novo Chat</button>
          </div>
        </div>

        <!-- Tabs -->
        <nav class="ws-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="tab-btn"
                    [class.active]="activeTab() === tab.id"
                    (click)="activeTab.set(tab.id)">
              {{ tab.icon }} {{ tab.label }}
              @if (tab.count != null && tab.count > 0) {
                <span class="tab-count">{{ tab.count }}</span>
              }
            </button>
          }
        </nav>

        <!-- Tab content -->
        <div class="ws-content">

          <!-- Overview -->
          @if (activeTab() === 'overview') {
            <div class="overview-grid">
              <div class="overview-main">

                <!-- Quick chat -->
                <div class="quick-chat-card">
                  <h3>Pergunte algo sobre este projeto</h3>
                  <div class="quick-input-row">
                    <input type="text" [(ngModel)]="quickQuestion"
                           placeholder="Ex: Resuma os riscos encontrados..."
                           (keydown.enter)="askQuick()" />
                    <button class="btn-primary" (click)="askQuick()" [disabled]="!quickQuestion.trim()">→</button>
                  </div>
                </div>

                <!-- Recent chats -->
                <div class="section-card">
                  <div class="section-top">
                    <h3>💬 Conversas Recentes</h3>
                    <button class="link-btn" (click)="activeTab.set('chats')">Ver todas →</button>
                  </div>
                  @if (chats().length === 0) {
                    <p class="empty-hint">Nenhuma conversa ainda. Inicie uma acima.</p>
                  }
                  @for (chat of chats() | slice:0:5; track chat.id) {
                    <a [routerLink]="['/projects', project()!.id, 'chat', chat.id]" class="chat-row">
                      <span class="chat-title">{{ chat.title || 'Conversa sem título' }}</span>
                      <span class="chat-meta">{{ chat.message_count }} msgs</span>
                    </a>
                  }
                </div>

                <!-- Recent docs -->
                <div class="section-card">
                  <div class="section-top">
                    <h3>📄 Documentos</h3>
                    <button class="link-btn" (click)="activeTab.set('documents')">Ver todos →</button>
                  </div>
                  @for (doc of documents() | slice:0:5; track doc.id) {
                    <div class="doc-row">
                      <span class="doc-name">{{ doc.filename }}</span>
                      <span class="doc-status" [class]="doc.processing_status">
                        {{ doc.processing_status === 'indexed' ? '✅' : doc.processing_status === 'processing' ? '⏳' : '❌' }}
                        {{ doc.chunks_count }} chunks
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- Sidebar -->
              <div class="overview-side">
                <!-- Instructions -->
                <div class="side-card">
                  <h4>📝 Instruções Ativas</h4>
                  @for (inst of instructions().filter(i => i.is_active); track inst.id) {
                    <div class="inst-row">
                      <span>{{ inst.name }}</span>
                      <span class="inst-mode">{{ inst.trigger_mode === 'always' ? '🔁' : '👆' }}</span>
                    </div>
                  }
                  @if (instructions().filter(i => i.is_active).length === 0) {
                    <p class="empty-hint">Nenhuma instrução configurada.</p>
                  }
                  <button class="link-btn" (click)="activeTab.set('instructions')">Gerenciar →</button>
                </div>

                <!-- Members -->
                <div class="side-card">
                  <h4>👥 Equipe</h4>
                  @for (m of members(); track m.user_id) {
                    <div class="member-row">
                      <span class="member-avatar">{{ m.name.slice(0,2) }}</span>
                      <span class="member-name">{{ m.name }}</span>
                      <span class="member-role">{{ m.role }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Chats tab -->
          @if (activeTab() === 'chats') {
            <div class="chats-tab">
              <div class="tab-actions">
                <input type="text" [(ngModel)]="chatSearch" placeholder="Buscar conversas..." class="tab-search" />
                <button class="btn-primary" (click)="newChat()">+ Novo Chat</button>
              </div>
              @for (chat of filteredChats(); track chat.id) {
                <a [routerLink]="['/projects', project()!.id, 'chat', chat.id]" class="chat-card">
                  <div class="chat-card-top">
                    <h4>{{ chat.title || 'Conversa sem título' }}</h4>
                    @if (chat.is_pinned) { <span class="pin">📌</span> }
                  </div>
                  <div class="chat-card-meta">
                    <span>{{ chat.message_count }} mensagens</span>
                    <span>{{ timeAgo(chat.last_message_at) }}</span>
                  </div>
                </a>
              }
              @if (filteredChats().length === 0) {
                <div class="empty-tab">
                  <p>{{ chatSearch ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.' }}</p>
                </div>
              }
            </div>
          }

          <!-- Documents tab -->
          @if (activeTab() === 'documents') {
            <div class="docs-tab">
              <div class="tab-actions">
                <button class="btn-secondary" (click)="uploadDocs()">📎 Adicionar Documentos</button>
              </div>
              <table class="docs-table">
                <thead>
                  <tr><th>Nome</th><th>Status</th><th>Chunks</th><th>Tamanho</th><th>Adicionado</th></tr>
                </thead>
                <tbody>
                  @for (doc of documents(); track doc.id) {
                    <tr>
                      <td class="doc-name-cell">{{ doc.filename }}</td>
                      <td><span class="status-badge" [class]="doc.processing_status">{{ doc.processing_status }}</span></td>
                      <td>{{ doc.chunks_count }}</td>
                      <td>{{ formatSize(doc.size_bytes) }}</td>
                      <td>{{ timeAgo(doc.linked_at) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Instructions tab -->
          @if (activeTab() === 'instructions') {
            <div class="instructions-tab">
              <div class="tab-actions">
                <button class="btn-primary" (click)="addInstruction()">+ Nova Instrução</button>
              </div>
              @for (inst of instructions(); track inst.id) {
                <div class="instruction-card" [class.active]="inst.is_active">
                  <div class="inst-header">
                    <div class="inst-toggle" (click)="toggleInstruction(inst)">
                      <span class="toggle-dot" [class.on]="inst.is_active"></span>
                    </div>
                    <div class="inst-info">
                      <h4>{{ inst.name }}</h4>
                      @if (inst.description) { <p>{{ inst.description }}</p> }
                    </div>
                    <span class="inst-trigger">{{ inst.trigger_mode === 'always' ? '🔁 Sempre' : '👆 Manual' }}</span>
                  </div>
                  <pre class="inst-preview">{{ inst.content | slice:0:300 }}{{ inst.content.length > 300 ? '...' : '' }}</pre>
                </div>
              }
              @if (instructions().length === 0) {
                <div class="empty-tab">
                  <p>Nenhuma instrução configurada. Instruções definem como a IA se comporta neste projeto.</p>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .workspace { padding: 24px 32px; max-width: 1100px; margin: 0 auto; }
    .loading-page { padding: 60px; text-align: center; color: var(--color-text-secondary, #888); }

    /* Header */
    .ws-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .ws-identity { display: flex; align-items: center; gap: 14px; }
    .back-link { background: none; border: none; color: var(--color-text-secondary, #888); cursor: pointer; font-size: 13px; margin-right: 4px; }
    .ws-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
    }
    h1 { font-size: 20px; font-weight: 700; margin: 0; }
    .ws-desc { font-size: 13px; color: var(--color-text-secondary, #666); margin: 2px 0 0; }

    /* Tabs */
    .ws-tabs {
      display: flex; gap: 4px; margin-bottom: 20px; padding-bottom: 1px;
      border-bottom: 1px solid var(--color-border, #e2e8f0);
    }
    .tab-btn {
      padding: 8px 14px; border: none; background: none;
      font-size: 13px; color: var(--color-text-secondary, #888);
      cursor: pointer; border-radius: 6px 6px 0 0;
      border-bottom: 2px solid transparent;
      transition: color 0.12s, border-color 0.12s;
    }
    .tab-btn:hover { color: var(--color-text-primary, #111); }
    .tab-btn.active {
      color: var(--color-primary, #6366f1);
      border-bottom-color: var(--color-primary, #6366f1);
      font-weight: 600;
    }
    .tab-count {
      font-size: 11px; background: var(--color-surface, #f1f5f9);
      padding: 1px 6px; border-radius: 10px; margin-left: 4px;
    }

    /* Overview grid */
    .overview-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
    @media (max-width: 800px) { .overview-grid { grid-template-columns: 1fr; } }

    .quick-chat-card {
      padding: 20px; background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0); border-radius: 12px;
      margin-bottom: 16px;
    }
    .quick-chat-card h3 { font-size: 15px; margin: 0 0 10px; }
    .quick-input-row { display: flex; gap: 8px; }
    .quick-input-row input {
      flex: 1; padding: 10px 12px; border-radius: 8px;
      border: 1px solid var(--color-border, #d1d5db);
      font-size: 14px; background: var(--color-background, #fafafa);
    }
    .quick-input-row input:focus { outline: none; border-color: var(--color-primary, #6366f1); }

    .section-card {
      padding: 16px 20px; background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0); border-radius: 12px;
      margin-bottom: 16px;
    }
    .section-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .section-top h3 { font-size: 14px; margin: 0; }
    .link-btn { background: none; border: none; color: var(--color-primary, #6366f1); font-size: 12px; cursor: pointer; }
    .empty-hint { font-size: 13px; color: var(--color-text-secondary, #aaa); }

    .chat-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid var(--color-border, #f1f5f9);
      text-decoration: none; color: inherit; font-size: 13px;
    }
    .chat-row:last-child { border-bottom: none; }
    .chat-row:hover { color: var(--color-primary, #6366f1); }
    .chat-meta { font-size: 11px; color: var(--color-text-secondary, #aaa); }

    .doc-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0; font-size: 13px;
    }
    .doc-status { font-size: 11px; color: var(--color-text-secondary, #888); }

    /* Side cards */
    .side-card {
      padding: 16px; background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0); border-radius: 12px;
      margin-bottom: 12px;
    }
    .side-card h4 { font-size: 13px; margin: 0 0 10px; }
    .inst-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .member-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; }
    .member-avatar {
      width: 26px; height: 26px; border-radius: 6px;
      background: var(--color-primary, #6366f1); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; flex-shrink: 0;
    }
    .member-role { margin-left: auto; font-size: 11px; color: var(--color-text-secondary, #aaa); }

    /* Chats tab */
    .tab-actions { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; align-items: center; }
    .tab-search {
      flex: 1; max-width: 300px; padding: 8px 12px; border-radius: 8px;
      border: 1px solid var(--color-border, #d1d5db); font-size: 13px;
    }
    .chat-card {
      display: block; padding: 14px 16px; background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0); border-radius: 10px;
      margin-bottom: 8px; text-decoration: none; color: inherit; transition: border-color 0.12s;
    }
    .chat-card:hover { border-color: var(--color-primary, #6366f1); }
    .chat-card-top { display: flex; justify-content: space-between; align-items: center; }
    .chat-card-top h4 { font-size: 14px; margin: 0; }
    .chat-card-meta { font-size: 12px; color: var(--color-text-secondary, #888); margin-top: 4px; display: flex; gap: 12px; }

    /* Docs tab */
    .docs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .docs-table th { text-align: left; padding: 8px 12px; color: var(--color-text-secondary, #888); font-weight: 500; border-bottom: 1px solid var(--color-border, #e2e8f0); }
    .docs-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border, #f1f5f9); }
    .status-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .status-badge.indexed { background: #dcfce7; color: #166534; }
    .status-badge.processing { background: #fef3c7; color: #92400e; }
    .status-badge.error { background: #fee2e2; color: #991b1b; }

    /* Instructions tab */
    .instruction-card {
      padding: 16px; border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 10px; margin-bottom: 10px;
    }
    .instruction-card.active { border-left: 3px solid var(--color-primary, #6366f1); }
    .inst-header { display: flex; align-items: flex-start; gap: 12px; }
    .toggle-dot {
      width: 20px; height: 12px; border-radius: 6px; background: #d1d5db; cursor: pointer;
      position: relative; transition: background 0.2s; flex-shrink: 0; margin-top: 4px;
    }
    .toggle-dot.on { background: var(--color-primary, #6366f1); }
    .toggle-dot::after {
      content: ''; width: 8px; height: 8px; border-radius: 50%;
      background: #fff; position: absolute; top: 2px; left: 2px; transition: left 0.2s;
    }
    .toggle-dot.on::after { left: 10px; }
    .inst-info { flex: 1; }
    .inst-info h4 { font-size: 14px; margin: 0; }
    .inst-info p { font-size: 12px; color: var(--color-text-secondary, #888); margin: 2px 0 0; }
    .inst-trigger { font-size: 11px; color: var(--color-text-secondary, #aaa); white-space: nowrap; }
    .inst-preview {
      font-size: 12px; color: var(--color-text-secondary, #666);
      background: var(--color-background, #f8fafc); padding: 10px 12px;
      border-radius: 6px; margin-top: 10px; white-space: pre-wrap; font-family: inherit;
      max-height: 120px; overflow: hidden;
    }

    .empty-tab { text-align: center; padding: 40px; color: var(--color-text-secondary, #888); }

    .btn-primary {
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: var(--color-primary, #6366f1); color: #fff; border: none; cursor: pointer;
    }
    .btn-secondary {
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      background: transparent; border: 1px solid var(--color-border, #d1d5db);
      color: var(--color-text-primary, #111); cursor: pointer;
    }
  `]
})
export class ProjectWorkspaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private wsCtx = inject(WorkspaceContextService);

  loading = signal(true);
  project = signal<Project | null>(null);
  documents = signal<ProjectDocument[]>([]);
  chats = signal<ProjectChat[]>([]);
  instructions = signal<ProjectInstruction[]>([]);
  members = signal<ProjectMember[]>([]);
  activeTab = signal('overview');
  quickQuestion = '';
  chatSearch = '';

  tabs = [
    { id: 'overview', icon: '📊', label: 'Visão Geral', count: null as number | null },
    { id: 'chats', icon: '💬', label: 'Conversas', count: 0 },
    { id: 'documents', icon: '📄', label: 'Documentos', count: 0 },
    { id: 'instructions', icon: '📝', label: 'Instruções', count: null },
  ];

  filteredChats = computed(() => {
    const q = this.chatSearch.toLowerCase();
    if (!q) return this.chats();
    return this.chats().filter(c => (c.title || '').toLowerCase().includes(q));
  });

  ngOnInit() {
    this.route.params.pipe(
      switchMap(params => {
        const id = params['id'];
        this.loading.set(true);
        const headers = { 'X-Workspace-ID': this.wsCtx.workspaceId() };
        return this.http.get<Project>(`/api/v1/projects/${id}`, { headers });
      })
    ).subscribe({
      next: (proj) => {
        this.project.set(proj);
        this.loadRelated(proj.id);
      },
      error: () => { this.loading.set(false); }
    });
  }

  private loadRelated(projectId: string) {
    const h = { 'X-Workspace-ID': this.wsCtx.workspaceId() };

    // Load docs, chats, instructions, members in parallel
    this.http.get<ProjectDocument[]>(`/api/v1/projects/${projectId}/documents`, { headers: h })
      .subscribe({ next: d => { this.documents.set(d); this.tabs[2].count = d.length; } });

    this.http.get<ProjectChat[]>(`/api/v1/projects/${projectId}/chats`, { headers: h })
      .subscribe({ next: c => { this.chats.set(c); this.tabs[1].count = c.length; } });

    this.http.get<ProjectInstruction[]>(`/api/v1/projects/${projectId}/instructions`, { headers: h })
      .subscribe({ next: i => this.instructions.set(i) });

    this.http.get<ProjectMember[]>(`/api/v1/projects/${projectId}/members`, { headers: h })
      .subscribe({
        next: m => this.members.set(m),
        complete: () => this.loading.set(false)
      });
  }

  newChat() {
    this.router.navigate(['/projects', this.project()!.id, 'chat', 'new']);
  }

  askQuick() {
    if (!this.quickQuestion.trim()) return;
    // Navigate to new chat with pre-filled question
    this.router.navigate(['/projects', this.project()!.id, 'chat', 'new'], {
      queryParams: { q: this.quickQuestion }
    });
  }

  toggleInstruction(inst: ProjectInstruction) {
    inst.is_active = !inst.is_active;
    const h = { 'X-Workspace-ID': this.wsCtx.workspaceId() };
    this.http.put(`/api/v1/projects/${this.project()!.id}/instructions/${inst.id}`, {
      is_active: inst.is_active
    }, { headers: h }).subscribe();
  }

  uploadDocs() {
    // TODO: open upload modal
    alert('Upload modal - a implementar');
  }

  addInstruction() {
    // TODO: open instruction editor
    alert('Editor de instrução - a implementar');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}m`;
  }
}