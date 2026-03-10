import {
  Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface TrainingBatch {
  id: string;
  loraVersion: string;
  baseModel: string;
  totalExamples: number;
  positiveExamples: number;
  correctedExamples: number;
  documentExamples: number;
  status: 'queued' | 'training' | 'evaluating' | 'deployed' | 'rolled_back';
  trainingLoss?: number;
  accuracy?: number;
  startedAt?: string;
  completedAt?: string;
  deployedAt?: string;
  createdAt: string;
}

export interface QueuedExample {
  id: string;
  source: string;
  userMessage: string;
  approvedAt: string;
  weight: number;
}

@Component({
  selector: 'app-training-queue',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="training-queue">
      <h3>&#9654;&#65039; Fila de Treinamento</h3>

      <!-- Exemplos na fila -->
      <div class="queue-summary">
        <div class="queue-stat">
          <span class="q-num">{{ queuedCount() }}</span>
          <span class="q-label">exemplos prontos para treino</span>
        </div>
        <button
          class="btn-start-training"
          [disabled]="queuedCount() < 50 || isTraining()"
          (click)="startTraining()">
          @if (isTraining()) {
            <span class="spinner"></span> Treinando...
          } @else {
            &#9889; Iniciar treinamento agora
          }
        </button>
        @if (queuedCount() < 50) {
          <p class="queue-hint">Mínimo de 50 exemplos necessários ({{ queuedCount() }}/50)</p>
        }
      </div>

      <!-- Histórico de batches -->
      <h4>Histórico de Treinamentos</h4>
      @if (loading()) {
        <div class="loading">Carregando histórico...</div>
      } @else {
        <div class="batches-list">
          @for (batch of batches(); track batch.id) {
            <div class="batch-card" [class]="batch.status">
              <div class="batch-header">
                <span class="batch-version">{{ batch.loraVersion }}</span>
                <span class="batch-status-badge" [class]="batch.status">
                  {{ statusLabel(batch.status) }}
                </span>
                <span class="batch-date">{{ batch.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>

              <div class="batch-metrics">
                <span>&#128218; {{ batch.totalExamples }} exemplos</span>
                <span>&#128077; {{ batch.positiveExamples }} aprovados</span>
                <span>&#9999;&#65039; {{ batch.correctedExamples }} corrigidos</span>
                <span>&#128196; {{ batch.documentExamples }} de docs</span>
              </div>

              @if (batch.accuracy !== undefined) {
                <div class="batch-results">
                  <span>Acurácia: <strong>{{ (batch.accuracy * 100).toFixed(1) }}%</strong></span>
                  @if (batch.trainingLoss !== undefined) {
                    <span>Loss: <strong>{{ batch.trainingLoss.toFixed(4) }}</strong></span>
                  }
                </div>
              }

              @if (batch.status === 'deployed') {
                <div class="batch-timeline">
                  <span>Deploy: {{ batch.deployedAt | date:'dd/MM HH:mm' }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class TrainingQueueComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  batches = signal<TrainingBatch[]>([]);
  queuedCount = signal(0);
  isTraining = signal(false);

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http.get<{ count: number }>(`/api/admin/workspaces/${wsId}/training/queue-count`)
      .subscribe((r) => this.queuedCount.set(r.count));
    this.http.get<TrainingBatch[]>(`/api/admin/workspaces/${wsId}/training/batches`)
      .subscribe({
        next: (batches) => { this.batches.set(batches); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  startTraining(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.isTraining.set(true);
    this.http.post(`/api/admin/workspaces/${wsId}/training/start`, {})
      .subscribe({
        next: () => this.ngOnInit(),
        error: () => this.isTraining.set(false),
      });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      queued: '&#9203; Na fila',
      training: '&#9889; Treinando',
      evaluating: '&#128269; Avaliando',
      deployed: '&#128640; Deployed',
      rolled_back: '&#9194;&#65039; Rollback',
    };
    return map[status] ?? status;
  }
}
