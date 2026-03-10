import {
  Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface PendingInteraction {
  id: string;
  userMessage: string;
  assistantResponse: string;
  userCorrection: string | null;
  feedbackCategories: string[];
  userRating: 'positive' | 'negative' | null;
  classification: string;
  piiDetected: boolean;
  source: 'user_approved' | 'user_corrected' | 'synthetic_from_docs';
  priority: 'high' | 'normal';
  createdAt: string;
  finalAnswer: string;
}

export interface CurationStats {
  pendingReview: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  nextTrainingIn: string;
  currentLoraVersion: string;
  totalExamples: number;
}

@Component({
  selector: 'app-feedback-review',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="dashboard">
      <h2>&#127919; Curadoria de Dados de Treinamento</h2>

      <!-- Métricas -->
      @if (stats()) {
        <div class="metrics-bar">
          <div class="metric pending">
            <span class="number">{{ stats()!.pendingReview }}</span>
            <span class="label">Pendentes</span>
          </div>
          <div class="metric approved">
            <span class="number">{{ stats()!.approvedThisWeek }}</span>
            <span class="label">Aprovados (semana)</span>
          </div>
          <div class="metric rejected">
            <span class="number">{{ stats()!.rejectedThisWeek }}</span>
            <span class="label">Rejeitados (semana)</span>
          </div>
          <div class="metric training">
            <span class="number">{{ stats()!.nextTrainingIn }}</span>
            <span class="label">Próximo treino</span>
          </div>
          <div class="metric version">
            <span class="number">{{ stats()!.currentLoraVersion }}</span>
            <span class="label">Versão ativa</span>
          </div>
        </div>
      }

      <!-- Filtros -->
      <div class="filters">
        <select [(ngModel)]="sourceFilter" (ngModelChange)="applyFilters()">
          <option value="">Todas as fontes</option>
          <option value="user_approved">&#128077; Aprovados por usuários</option>
          <option value="user_corrected">&#9999;&#65039; Com correções</option>
          <option value="synthetic_from_docs">&#129302; Q&amp;A sintéticos</option>
        </select>
        <select [(ngModel)]="priorityFilter" (ngModelChange)="applyFilters()">
          <option value="">Todas prioridades</option>
          <option value="high">&#128308; Alta (com correção)</option>
          <option value="normal">&#128993; Normal</option>
        </select>
        <button class="btn-approve-all" (click)="approveAll()"
          [disabled]="filtered().length === 0">
          &#9989; Aprovar todos filtrados ({{ filtered().length }})
        </button>
      </div>

      <!-- Lista de itens -->
      @if (loading()) {
        <div class="loading">Carregando interações...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <p>&#127881; Nenhum item pendente de revisão!</p>
        </div>
      } @else {
        @for (item of filtered(); track item.id) {
          <div class="review-card" [class.high-priority]="item.priority === 'high'">
            <div class="card-header">
              <span class="source-badge" [class]="item.source">{{ sourceLabel(item.source) }}</span>
              @if (item.priority === 'high') {
                <span class="priority-badge">&#128308; Alta prioridade</span>
              }
              <span class="date">{{ item.createdAt | date:'dd/MM HH:mm' }}</span>
              @if (item.piiDetected) {
                <span class="pii-warning">&#9888;&#65039; PII detectado</span>
              }
            </div>

            <div class="qa-pair">
              <div class="field">
                <strong>Pergunta do usuário:</strong>
                <p>{{ item.userMessage }}</p>
              </div>
              <div class="field">
                <strong>Resposta original do modelo:</strong>
                <p>{{ item.assistantResponse }}</p>
              </div>
              @if (item.userCorrection) {
                <div class="field correction">
                  <strong>&#9999;&#65039; Correção do usuário:</strong>
                  <p>{{ item.userCorrection }}</p>
                </div>
              }
              <div class="field editor">
                <strong>Resposta final para treino:</strong>
                <textarea [(ngModel)]="item.finalAnswer" rows="4"></textarea>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn-approve" (click)="approve(item)">&#9989; Aprovar</button>
              <button class="btn-reject" (click)="reject(item)">&#10060; Rejeitar</button>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class FeedbackReviewComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  items = signal<PendingInteraction[]>([]);
  filtered = signal<PendingInteraction[]>([]);
  stats = signal<CurationStats | null>(null);
  sourceFilter = '';
  priorityFilter = '';

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http.get<CurationStats>(`/api/admin/workspaces/${wsId}/training/stats`)
      .subscribe((s) => this.stats.set(s));
    this.http.get<PendingInteraction[]>(`/api/admin/workspaces/${wsId}/training/pending`)
      .subscribe({
        next: (data) => {
          const withFinal = data.map((i) => ({
            ...i,
            finalAnswer: i.userCorrection ?? i.assistantResponse,
          }));
          this.items.set(withFinal);
          this.filtered.set(withFinal);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  applyFilters(): void {
    let result = this.items();
    if (this.sourceFilter) result = result.filter((i) => i.source === this.sourceFilter);
    if (this.priorityFilter) result = result.filter((i) => i.priority === this.priorityFilter);
    this.filtered.set(result);
  }

  approve(item: PendingInteraction): void {
    this.http.post(`/api/admin/training/${item.id}/approve`, { finalAnswer: item.finalAnswer })
      .subscribe(() => this.removeItem(item.id));
  }

  reject(item: PendingInteraction): void {
    this.http.post(`/api/admin/training/${item.id}/reject`, {})
      .subscribe(() => this.removeItem(item.id));
  }

  approveAll(): void {
    const ids = this.filtered().map((i) => ({ id: i.id, finalAnswer: i.finalAnswer }));
    this.http.post(`/api/admin/training/approve-batch`, { items: ids })
      .subscribe(() => {
        const approvedIds = new Set(ids.map((i) => i.id));
        this.items.update((all) => all.filter((i) => !approvedIds.has(i.id)));
        this.applyFilters();
      });
  }

  private removeItem(id: string): void {
    this.items.update((all) => all.filter((i) => i.id !== id));
    this.applyFilters();
    this.stats.update((s) => s ? { ...s, pendingReview: Math.max(0, s.pendingReview - 1) } : s);
  }

  sourceLabel(source: string): string {
    const map: Record<string, string> = {
      user_approved: '&#128077; Aprovado',
      user_corrected: '&#9999;&#65039; Corrigido',
      synthetic_from_docs: '&#129302; Sintético',
    };
    return map[source] ?? source;
  }
}
