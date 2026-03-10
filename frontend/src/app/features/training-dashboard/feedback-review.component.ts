import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TrainingInteractionSummary } from '../../shared/models/feedback.model';

export interface TrainingStats {
  pendingReview: number;
  approvedThisWeek: number;
  nextTrainingIn: string;
  currentLoraVersion: string;
}

@Component({
  selector: 'app-feedback-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <h2>Curadoria de Dados de Treinamento</h2>

      <!-- Métricas -->
      <div class="metrics-bar">
        <div class="metric">
          <span class="number">{{ stats?.pendingReview ?? 0 }}</span>
          <span class="label">Pendentes</span>
        </div>
        <div class="metric">
          <span class="number">{{ stats?.approvedThisWeek ?? 0 }}</span>
          <span class="label">Aprovados (semana)</span>
        </div>
        <div class="metric">
          <span class="number">{{ stats?.nextTrainingIn ?? '-' }}</span>
          <span class="label">Próximo treino em</span>
        </div>
        <div class="metric">
          <span class="number">{{ stats?.currentLoraVersion ?? '-' }}</span>
          <span class="label">Versão atual</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <select [(ngModel)]="sourceFilter" (change)="load()">
          <option value="all">Todas as fontes</option>
          <option value="user_approved">👍 Aprovados por usuários</option>
          <option value="user_corrected">✏️ Com correções</option>
          <option value="synthetic">🤖 Q&A sintéticos</option>
        </select>
        <select [(ngModel)]="priorityFilter" (change)="load()">
          <option value="all">Todas prioridades</option>
          <option value="high">🔴 Alta (com correção)</option>
          <option value="normal">🟡 Normal</option>
        </select>
      </div>

      <!-- Itens para curadoria -->
      @for (item of pendingItems; track item.id) {
        <div class="review-card" [class.high-priority]="item.priority === 'high'">
          <div class="source-badge">{{ item.curatorStatus }}</div>
          <div class="qa-pair">
            <div class="question">
              <strong>Pergunta:</strong>
              <p>{{ item.userMessage }}</p>
            </div>
            <div class="original-response">
              <strong>Resposta original:</strong>
              <p>{{ item.assistantResponse }}</p>
            </div>
            @if (item.userCorrection) {
              <div class="correction">
                <strong>Correção do usuário:</strong>
                <p>{{ item.userCorrection }}</p>
              </div>
            }
            <div class="curator-edit">
              <strong>Resposta final para treino:</strong>
              <textarea [(ngModel)]="item.userCorrection" rows="4"></textarea>
            </div>
          </div>
          <div class="actions">
            <button class="approve" (click)="approve(item)">✅ Aprovar para treino</button>
            <button class="reject" (click)="reject(item)">❌ Rejeitar</button>
          </div>
        </div>
      }
    </div>
  `
})
export class FeedbackReviewComponent implements OnInit {
  private http = inject(HttpClient);

  stats: TrainingStats | null = null;
  pendingItems: TrainingInteractionSummary[] = [];
  sourceFilter = 'all';
  priorityFilter = 'all';

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  loadStats(): void {
    this.http.get<TrainingStats>('/api/admin/training/stats').subscribe(s => this.stats = s);
  }

  load(): void {
    this.http.get<TrainingInteractionSummary[]>(
      '/api/admin/training/pending',
      { params: { source: this.sourceFilter, priority: this.priorityFilter } }
    ).subscribe(items => this.pendingItems = items);
  }

  approve(item: TrainingInteractionSummary): void {
    this.http.post(`/api/admin/training/${item.id}/approve`,
      { finalAnswer: item.userCorrection }
    ).subscribe(() => this.removeItem(item.id));
  }

  reject(item: TrainingInteractionSummary): void {
    this.http.post(`/api/admin/training/${item.id}/reject`, {}).subscribe(() => this.removeItem(item.id));
  }

  private removeItem(id: string): void {
    this.pendingItems = this.pendingItems.filter(i => i.id !== id);
    this.loadStats();
  }
}
