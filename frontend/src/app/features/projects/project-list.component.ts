import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  member_count: number;
  chat_count: number;
  document_count: number;
  created_at: string;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Projetos</h1>
          <p class="subtitle">Ambientes isolados com documentos e instruções próprias</p>
        </div>
        <a routerLink="/projects/new" class="btn-primary">+ Novo Projeto</a>
      </div>

      @if (loading()) {
        <div class="loading">Carregando projetos...</div>
      } @else if (projects().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h3>Nenhum projeto ainda</h3>
          <p>Crie seu primeiro projeto para organizar documentos e conversas.</p>
          <a routerLink="/projects/new" class="btn-primary">Criar Projeto</a>
        </div>
      } @else {
        <div class="projects-grid">
          @for (p of projects(); track p.id) {
            <a [routerLink]="['/projects', p.id]" class="project-card">
              <div class="card-header">
                <span class="project-icon" [style.background]="p.color + '22'">{{ p.icon || '📁' }}</span>
                <div class="project-meta">
                  <h3>{{ p.name }}</h3>
                  <span class="date">{{ p.created_at | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
              @if (p.description) {
                <p class="desc">{{ p.description }}</p>
              }
              <div class="card-stats">
                <span>👥 {{ p.member_count }}</span>
                <span>💬 {{ p.chat_count }}</span>
                <span>📄 {{ p.document_count }}</span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 4px; }
    .subtitle { color: #888; font-size: 0.9rem; margin: 0; }
    .btn-primary { background: #6366f1; color: #fff; padding: 8px 18px; border-radius: 8px; text-decoration: none; font-size: 0.9rem; }
    .loading, .empty-state { text-align: center; padding: 4rem; color: #888; }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
    .empty-state h3 { margin-bottom: 0.5rem; }
    .empty-state p { margin-bottom: 1.5rem; color: #666; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .project-card { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; display: block; transition: border-color 0.15s, transform 0.15s; }
    .project-card:hover { border-color: #6366f1; transform: translateY(-2px); }
    .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 0.75rem; }
    .project-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
    .project-meta h3 { margin: 0 0 2px; font-size: 1rem; }
    .date { font-size: 0.75rem; color: #666; }
    .desc { color: #999; font-size: 0.85rem; margin: 0 0 1rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-stats { display: flex; gap: 1rem; font-size: 0.8rem; color: #777; border-top: 1px solid #2a2a2a; padding-top: 0.75rem; margin-top: 0.75rem; }
  `]
})
export class ProjectListComponent implements OnInit {
  projects = signal<Project[]>([]);
  loading = signal(true);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<{ projects: Project[] }>('/api/v1/projects/').subscribe({
      next: res => { this.projects.set(res.projects); this.loading.set(false); },
      error: () => { this.loading.set(false); }
    });
  }
}
