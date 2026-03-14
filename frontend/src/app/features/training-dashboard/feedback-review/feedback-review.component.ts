import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingService, TrainingInteraction } from '../training.service';
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
      <div class="stats-bar">
        <div class="stat">
          <span class="number">{{ pendingCount }}</span>
          <span class="label">Pendentes</span>
        </div>
        <div class="stat">
          <span class="number">{{ approvedCount }}</span>
          <span class="label">Aprovados</span>
        </div>
        <div class="stat">
          <span class="number">{{ correctedCount }}</span>
          <span class="label">Com correção</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <select [(ngModel)]="statusFilter" (change)="loadItems()">
          <option value="">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="rejected">Rejeitados</option>
        </select>
        <button class="btn-secondary" (click)="bulkApproveAll()" [disabled]="selectedIds.length === 0">
          Aprovar selecionados ({{ selectedIds.length }})
        </button>
      </div>

      <!-- Lista de itens -->
      <div class="items-list">
        @for (item of items; track item.id) {
          <div class="review-card"
            [class.selected]="selectedIds.includes(item.id)"
            [class.has-correction]="!!item.user_correction">

            <div class="card-header">
              <label class="checkbox-wrap">
                <input type="checkbox"
                  [checked]="selectedIds.includes(item.id)"
                  (change)="toggleSelect(item.id)">
              </label>
              <span class="rating-badge" [class]="item.user_rating ?? 'none'">
                {{ item.user_rating === 'positive' ? '👍 Positivo' : item.user_rating === 'negative' ? '👎 Negativo' : '—' }}
              </span>
              @if (item.user_correction) {
                <span class="correction-badge">✏ Tem correção</span>
              }
              <span class="classification-badge">{{ item.data_classification }}</span>
              <span class="status-badge" [class]="item.curator_status">{{ item.curator_status }}</span>
            </div>

            <div class="qa-pair">
              <div class="question">
                <strong>Pergunta</strong>
                <p>{{ item.user_message }}</p>
              </div>
              <div class="original-response">
                <strong>Resposta do modelo</strong>
                <p>{{ item.assistant_response }}</p>
              </div>
              @if (item.user_correction) {
                <div class="correction">
                  <strong>✏ Correção do usuário</strong>
                  <p>{{ item.user_correction }}</p>
                </div>
              }
            </div>

            @if (item.curator_status === 'pending') {
              <div class="actions">
                <button class="approve" (click)="approve(item)">&#10003; Aprovar</button>
                <button class="reject" (click)="reject(item)">&#10007; Rejeitar</button>
              </div>
            }
          </div>
        }

        @if (items.length === 0 && !loading) {
          <div class="empty-state">
            <p>Nenhum item encontrado para o filtro selecionado.</p>
          </div>
        }
      </div>

      <!-- Paginação -->
      @if (total > perPage) {
        <div class="pagination">
          <button [disabled]="page === 1" (click)="prevPage()">← Anterior</button>
          <span>Pág. {{ page }} de {{ totalPages }}</span>
          <button [disabled]="page >= totalPages" (click)="nextPage()">Próxima →</button>
        </div>
      }
    </div>
  `,
  styleUrls: ['./feedback-review.component.scss'],
})
export class FeedbackReviewComponent implements OnInit {
  private trainingService = inject(TrainingService);
  // WorkspaceContextService nao e necessario: o token JWT ja carrega o workspace_id no backend

  items: TrainingInteraction[] = [];
  allItems: TrainingInteraction[] = []; // cache para calcular metricas
  selectedIds: string[] = [];
  statusFilter = '';
  page = 1;
  perPage = 20;
  total = 0;
  loading = false;
  triggering = false;

  get totalPages(): number { return Math.ceil(this.total / this.perPage); }
  get pendingCount(): number  { return this.allItems.filter(i => i.curator_status === 'pending').length; }
  get approvedCount(): number { return this.allItems.filter(i => i.curator_status === 'approved').length; }
  get correctedCount(): number { return this.allItems.filter(i => !!i.user_correction).length; }

  ngOnInit(): void {
    this.loadAll();
    this.loadItems();
  }

  loadAll(): void {
    this.trainingService.getQueue().subscribe(items => (this.allItems = items));
  }

  loadItems(): void {
    this.loading = true;
    const query = {
      ...(this.statusFilter ? { status: this.statusFilter as 'pending' | 'approved' | 'rejected' } : {}),
      page: this.page,
      per_page: this.perPage,
    };
    this.trainingService.getQueue(query).subscribe(items => {
      this.items = items;
      this.total = items.length; // backend nao retorna total separado, usar length
      this.selectedIds = [];
      this.loading = false;
    });
  }

  approve(item: TrainingInteraction): void {
    this.trainingService.approveInteraction(item.id).subscribe(() => {
      this.items = this.items.filter(i => i.id !== item.id);
      this.loadAll();
    });
  }

  reject(item: TrainingInteraction): void {
    this.trainingService.rejectInteraction(item.id).subscribe(() => {
      this.items = this.items.filter(i => i.id !== item.id);
    });
  }

  toggleSelect(id: string): void {
    const idx = this.selectedIds.indexOf(id);
    idx === -1 ? this.selectedIds.push(id) : this.selectedIds.splice(idx, 1);
  }

  bulkApproveAll(): void {
    const ids = [...this.selectedIds];
    const approvals = ids.map(id => this.trainingService.approveInteraction(id));
    import('rxjs').then(({ forkJoin }) =>
      forkJoin(approvals).subscribe(() => {
        this.items = this.items.filter(i => !ids.includes(i.id));
        this.selectedIds = [];
        this.loadAll();
      })
    );
  }

  triggerTraining(): void {
    this.triggering = true;
    this.trainingService.startBatch({}).subscribe({
      next: batch => {
        alert(`Treinamento iniciado! Batch ID: ${batch.id}`);
        this.triggering = false;
      },
      error: (err) => {
        alert(err?.error?.message ?? 'Erro ao iniciar treinamento.');
        this.triggering = false;
      },
    });
  }

  prevPage(): void { this.page--; this.loadItems(); }
  nextPage(): void { this.page++; this.loadItems(); }
}
