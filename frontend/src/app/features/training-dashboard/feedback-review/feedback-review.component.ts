import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingService, TrainingItem, TrainingStats } from '../training.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-feedback-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="feedback-review">
      <div class="page-header">
        <div>
          <h1>Curadoria de Dados</h1>
          <p>Revise e aprove dados para o ciclo de fine-tuning</p>
        </div>
        <button class="btn-primary" (click)="triggerTraining()" [disabled]="triggering">
          {{ triggering ? 'Iniciando...' : '▶ Treinar agora' }}
        </button>
      </div>

      <!-- Métricas rápidas -->
      <div class="stats-bar" *ngIf="stats">
        <div class="stat">
          <span class="number">{{ stats.pendingReview }}</span>
          <span class="label">Pendentes</span>
        </div>
        <div class="stat">
          <span class="number">{{ stats.approvedThisWeek }}</span>
          <span class="label">Aprovados (semana)</span>
        </div>
        <div class="stat">
          <span class="number">{{ stats.nextTrainingIn }}</span>
          <span class="label">Próximo treino</span>
        </div>
        <div class="stat">
          <span class="number">{{ stats.currentLoraVersion || '—' }}</span>
          <span class="label">Versão ativa</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <select [(ngModel)]="sourceFilter" (change)="loadItems()">
          <option value="all">Todas as fontes</option>
          <option value="user_approved">Aprovados por usuários</option>
          <option value="user_corrected">Com correções</option>
          <option value="synthetic_from_docs">QA sintéticos</option>
        </select>
        <select [(ngModel)]="priorityFilter" (change)="loadItems()">
          <option value="all">Todas as prioridades</option>
          <option value="high">Alta (com correção)</option>
          <option value="normal">Normal</option>
        </select>
        <button class="btn-secondary" (click)="bulkApproveAll()"
          [disabled]="selectedIds.length === 0">
          Aprovar selecionados ({{ selectedIds.length }})
        </button>
      </div>

      <!-- Lista de itens -->
      <div class="items-list">
        <div *ngFor="let item of items" class="review-card"
          [class.high-priority]="item.priority === 'high'"
          [class.selected]="selectedIds.includes(item.id)">

          <!-- Seleção + badge de fonte -->
          <div class="card-header">
            <label class="checkbox-wrap">
              <input type="checkbox" [checked]="selectedIds.includes(item.id)"
                (change)="toggleSelect(item.id)">
            </label>
            <span class="source-badge" [class]="item.source">{{ sourceLabel(item.source) }}</span>
            <span *ngIf="item.priority === 'high'" class="priority-badge">🔥 Alta prioridade</span>
            <span class="classification-badge">{{ item.classification }}</span>
            <span *ngIf="item.piiDetected" class="pii-badge">⚠ PII</span>
          </div>

          <!-- Par Q&A -->
          <div class="qa-pair">
            <div class="question">
              <strong>Pergunta</strong>
              <p>{{ item.userMessage }}</p>
            </div>
            <div class="original-response">
              <strong>Resposta original do modelo</strong>
              <p>{{ item.assistantResponse }}</p>
            </div>
            <div *ngIf="item.userCorrection" class="correction">
              <strong>✏ Correção do usuário</strong>
              <p>{{ item.userCorrection }}</p>
            </div>
          </div>

          <!-- Campo editável pelo curador -->
          <div class="curator-edit">
            <strong>Resposta final para treino</strong>
            <textarea [(ngModel)]="item.finalAnswer" rows="4"
              [placeholder]="item.userCorrection || item.assistantResponse">
            </textarea>
          </div>

          <!-- Ações -->
          <div class="actions">
            <button class="approve" (click)="approve(item)">✓ Aprovar</button>
            <button class="reject" (click)="reject(item)">✗ Rejeitar</button>
          </div>
        </div>
      </div>

      <!-- Paginação -->
      <div class="pagination" *ngIf="total > perPage">
        <button [disabled]="page === 1" (click)="prevPage()">← Anterior</button>
        <span>Pág. {{ page }} de {{ totalPages }}</span>
        <button [disabled]="page >= totalPages" (click)="nextPage()">Próxima →</button>
      </div>
    </div>
  `,
  styleUrls: ['./feedback-review.component.scss'],
})
export class FeedbackReviewComponent implements OnInit {
  private trainingService = inject(TrainingService);
  private wsCtx = inject(WorkspaceContextService);

  stats: TrainingStats | null = null;
  items: TrainingItem[] = [];
  selectedIds: string[] = [];
  sourceFilter = 'all';
  priorityFilter = 'all';
  page = 1;
  perPage = 20;
  total = 0;
  triggering = false;

  get totalPages() { return Math.ceil(this.total / this.perPage); }

  ngOnInit() {
    this.loadStats();
    this.loadItems();
  }

  loadStats() {
    this.trainingService.getStats(this.wsCtx.workspaceId).subscribe(
      (s) => (this.stats = s),
    );
  }

  loadItems() {
    this.trainingService
      .getPendingItems(this.wsCtx.workspaceId, this.sourceFilter, this.priorityFilter, this.page, this.perPage)
      .subscribe(({ items, total }) => {
        this.items = items.map((i) => ({ ...i, finalAnswer: i.userCorrection || i.assistantResponse }));
        this.total = total;
        this.selectedIds = [];
      });
  }

  approve(item: TrainingItem) {
    this.trainingService.approveItem(item.id, item.finalAnswer).subscribe(() => {
      this.items = this.items.filter((i) => i.id !== item.id);
      this.loadStats();
    });
  }

  reject(item: TrainingItem) {
    this.trainingService.rejectItem(item.id).subscribe(() => {
      this.items = this.items.filter((i) => i.id !== item.id);
    });
  }

  toggleSelect(id: string) {
    const idx = this.selectedIds.indexOf(id);
    idx === -1 ? this.selectedIds.push(id) : this.selectedIds.splice(idx, 1);
  }

  bulkApproveAll() {
    this.trainingService.bulkApprove(this.selectedIds).subscribe(() => {
      this.items = this.items.filter((i) => !this.selectedIds.includes(i.id));
      this.selectedIds = [];
      this.loadStats();
    });
  }

  triggerTraining() {
    this.triggering = true;
    this.trainingService.triggerTraining(this.wsCtx.workspaceId).subscribe({
      next: ({ jobId }) => { alert(`Treinamento iniciado! Job: ${jobId}`); this.triggering = false; },
      error: () => { this.triggering = false; },
    });
  }

  prevPage() { this.page--; this.loadItems(); }
  nextPage() { this.page++; this.loadItems(); }

  sourceLabel(s: string): string {
    return { user_approved: '👍 Aprovado', user_corrected: '✏ Corrigido', synthetic_from_docs: '🤖 Sintético' }[s] ?? s;
  }
}
