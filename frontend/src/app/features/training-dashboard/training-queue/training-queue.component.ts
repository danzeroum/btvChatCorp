import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, TrainingBatch } from '../training.service';

@Component({
  selector: 'app-training-queue',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="training-queue">
      <h1>Fila de Treinamento</h1>
      <p class="subtitle">Histórico de ciclos de fine-tuning</p>

      <div class="batches">
        @for (batch of batches; track batch.id) {
          <div class="batch-card">
            <div class="batch-header">
              <div class="version-badge">
                {{ batch.new_lora_version ?? batch.id.slice(0, 8) }}
              </div>
              <span class="status-badge" [class]="'status-' + batch.status">
                {{ statusLabel(batch.status) }}
              </span>
              @if (batch.deployed_at) {
                <span class="deploy-date">
                  Deploy: {{ batch.deployed_at | date:'dd/MM/yyyy HH:mm' }}
                </span>
              }
            </div>

            <div class="batch-stats">
              <div class="stat">
                <span class="value">{{ batch.total_examples ?? '—' }}</span>
                <span class="label">Exemplos totais</span>
              </div>
              <div class="stat">
                <span class="value">{{ batch.positive_examples ?? '—' }}</span>
                <span class="label">👍 Aprovados</span>
              </div>
              <div class="stat">
                <span class="value">{{ batch.corrected_examples ?? '—' }}</span>
                <span class="label">✏ Corrigidos</span>
              </div>
              <div class="stat">
                <span class="value">
                  {{ batch.eval_accuracy != null ? (batch.eval_accuracy | percent:'1.1-1') : '—' }}
                </span>
                <span class="label">Acurácia</span>
              </div>
            </div>

            <!-- Barra de progresso (para running/queued) ou acuracia (completed) -->
            @if (batch.status === 'running' || batch.status === 'queued') {
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="batch.progress ?? 0"></div>
              </div>
              <span class="progress-label">{{ batch.progress ?? 0 }}%</span>
            } @else if (batch.eval_accuracy != null) {
              <div class="accuracy-bar">
                <div class="accuracy-fill"
                  [style.width.%]="batch.eval_accuracy * 100"
                  [class.good]="batch.eval_accuracy >= 0.7"
                  [class.bad]="batch.eval_accuracy < 0.7">
                </div>
              </div>
            }

            @if (batch.error_message) {
              <p class="batch-error">{{ batch.error_message }}</p>
            }
          </div>
        }

        @if (batches.length === 0 && !loading) {
          <div class="empty">
            <p>Nenhum ciclo de treinamento ainda.<br>Aprove exemplos suficientes para iniciar.</p>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./training-queue.component.scss'],
})
export class TrainingQueueComponent implements OnInit {
  private trainingService = inject(TrainingService);

  batches: TrainingBatch[] = [];
  loading = true;

  ngOnInit(): void {
    this.trainingService.getBatches().subscribe(b => {
      this.batches = b;
      this.loading = false;
    });
  }

  statusLabel(s: string): string {
    return {
      pending:   '⏳ Pendente',
      queued:    '⏳ Na fila',
      running:   '🔄 Treinando',
      completed: '✅ Concluído',
      failed:    '❌ Falhou',
      cancelled: '⏹ Cancelado',
    }[s] ?? s;
  }
}
