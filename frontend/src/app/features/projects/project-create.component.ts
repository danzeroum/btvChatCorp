import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

const ICONS = ['📁','🚀','💡','🔬','📊','🏢','🎯','⚡','🌐','🔧','🎨','📱'];
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#ec4899','#14b8a6'];

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <a routerLink="/projects" class="back-btn">← Projetos</a>
        <h1>Novo Projeto</h1>
      </div>

      <div class="form-card">
        <div class="form-group">
          <label>Nome *</label>
          <input [(ngModel)]="name" placeholder="Ex: Suporte ao Cliente" maxlength="80" />
        </div>

        <div class="form-group">
          <label>Descrição</label>
          <textarea [(ngModel)]="description" rows="3" placeholder="Descreva o propósito deste projeto..."></textarea>
        </div>

        <div class="form-group">
          <label>Ícone</label>
          <div class="icon-grid">
            @for (ic of icons; track ic) {
              <button class="icon-btn" [class.selected]="icon === ic" (click)="icon = ic">{{ ic }}</button>
            }
          </div>
        </div>

        <div class="form-group">
          <label>Cor</label>
          <div class="color-grid">
            @for (c of colors; track c) {
              <button class="color-btn" [class.selected]="color === c" [style.background]="c" (click)="color = c"></button>
            }
          </div>
        </div>

        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }

        <div class="form-actions">
          <a routerLink="/projects" class="btn-secondary">Cancelar</a>
          <button class="btn-primary" [disabled]="!name.trim() || saving()" (click)="save()">
            {{ saving() ? 'Criando...' : 'Criar Projeto' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 600px; margin: 0 auto; }
    .page-header { margin-bottom: 2rem; }
    .back-btn { color: #888; text-decoration: none; font-size: 0.9rem; display: block; margin-bottom: 0.5rem; }
    h1 { font-size: 1.5rem; margin: 0; }
    .form-card { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; padding: 1.75rem; }
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 6px; }
    input, textarea { width: 100%; background: #0f0f0f; border: 1px solid #333; border-radius: 8px; padding: 10px 14px; color: #f0f0f0; font-size: 0.9rem; box-sizing: border-box; }
    textarea { resize: vertical; }
    .icon-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .icon-btn { background: #0f0f0f; border: 1px solid #333; border-radius: 8px; width: 40px; height: 40px; font-size: 1.2rem; cursor: pointer; }
    .icon-btn.selected { border-color: #6366f1; background: #6366f122; }
    .color-grid { display: flex; gap: 10px; flex-wrap: wrap; }
    .color-btn { width: 28px; height: 28px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; }
    .color-btn.selected { border-color: #fff; }
    .error-msg { background: #ef444422; border: 1px solid #ef4444; border-radius: 8px; padding: 10px 14px; color: #ef4444; font-size: 0.85rem; margin-bottom: 1rem; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid #2a2a2a; }
    .btn-primary { background: #6366f1; color: #fff; padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-secondary { background: #2a2a2a; color: #ccc; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 0.9rem; }
  `]
})
export class ProjectCreateComponent {
  name = '';
  description = '';
  icon = '📁';
  color = '#6366f1';
  saving = signal(false);
  error = signal('');

  icons = ICONS;
  colors = COLORS;

  constructor(private http: HttpClient, private router: Router) {}

  save() {
    if (!this.name.trim()) return;
    this.saving.set(true);
    this.error.set('');
    this.http.post<{ id: string }>('/api/v1/projects/', {
      name: this.name.trim(),
      description: this.description.trim(),
      icon: this.icon,
      color: this.color,
    }).subscribe({
      next: res => this.router.navigate(['/projects', res.id]),
      error: err => {
        this.error.set(err?.error?.detail || 'Erro ao criar projeto');
        this.saving.set(false);
      }
    });
  }
}
