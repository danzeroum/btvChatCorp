import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, RagConfig } from '../admin.service';

@Component({
  selector: 'app-rag-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="rag-config">
      <div class="page-header">
        <div>
          <h1>⚙️ Configuração do RAG</h1>
          <p>Ajuste os parâmetros de recuperação sem reiniciar o servidor.</p>
        </div>
        <a routerLink="/admin/dashboard" class="btn-secondary">← Voltar</a>
      </div>

      @if (cfg(); as c) {
        <div class="form-card">
          <div class="form-group">
            <label>top_k <span class="hint">— nº de trechos recuperados por pergunta</span></label>
            <input type="number" min="1" max="50" [(ngModel)]="c.topK">
          </div>
          <div class="form-group">
            <label>similarity_threshold <span class="hint">— score mínimo (0 a 1)</span></label>
            <input type="number" min="0" max="1" step="0.05" [(ngModel)]="c.similarityThreshold">
          </div>
          <div class="form-group">
            <label>chunk_size <span class="hint">— tamanho do trecho (tokens/chars)</span></label>
            <input type="number" min="64" max="4000" step="16" [(ngModel)]="c.chunkSize">
          </div>
          <div class="form-group">
            <label>chunk_overlap <span class="hint">— sobreposição entre trechos</span></label>
            <input type="number" min="0" max="1000" step="8" [(ngModel)]="c.chunkOverlap">
          </div>

          <div class="actions">
            <button class="btn-primary" [disabled]="saving()" (click)="save(c)">
              {{ saving() ? 'Salvando...' : 'Salvar' }}
            </button>
            @if (saved()) { <span class="saved-msg">✅ Salvo</span> }
          </div>
        </div>
      } @else {
        <p class="loading">Carregando configuração...</p>
      }
    </div>
  `,
  styles: [`
    .rag-config { max-width: 640px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .page-header h1 { margin:0 0 4px; font-size:1.4rem; }
    .page-header p { margin:0; color:#888; font-size:0.85rem; }
    .btn-secondary { padding:8px 14px; border-radius:8px; background:#1e1e1e; border:1px solid #2a2a2a; color:#bbb; text-decoration:none; font-size:0.85rem; }
    .form-card { background:#161616; border:1px solid #2a2a2a; border-radius:12px; padding:22px; display:flex; flex-direction:column; gap:18px; }
    .form-group { display:flex; flex-direction:column; gap:6px; }
    .form-group label { font-size:0.85rem; font-weight:600; }
    .hint { font-weight:400; color:#777; font-size:0.78rem; }
    .form-group input { background:#0d0d0d; border:1px solid #333; border-radius:8px; padding:9px 12px; color:#fff; font-size:0.9rem; }
    .form-group input:focus { outline:none; border-color:#6366f1; }
    .actions { display:flex; align-items:center; gap:12px; margin-top:4px; }
    .btn-primary { padding:9px 18px; border-radius:8px; background:#6366f1; color:#fff; border:none; cursor:pointer; font-weight:600; font-size:0.88rem; }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .saved-msg { color:#22c55e; font-size:0.85rem; }
    .loading { color:#777; }
  `],
})
export class RagConfigComponent implements OnInit {
  private adminService = inject(AdminService);
  cfg = signal<RagConfig | null>(null);
  saving = signal(false);
  saved = signal(false);

  ngOnInit() {
    this.adminService.getRagConfig().subscribe((c) => this.cfg.set(c));
  }

  save(c: RagConfig) {
    this.saving.set(true);
    this.saved.set(false);
    this.adminService.updateRagConfig(c).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 2500); },
      error: () => this.saving.set(false),
    });
  }
}
