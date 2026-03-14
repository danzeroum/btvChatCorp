import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, TrainingBatch } from '../training.service';

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="model-performance">
      <h1>Performance do Modelo</h1>
      <p class="subtitle">Evolução da acurácia ao longo dos ciclos de fine-tuning</p>

      <!-- Versão ativa (ultimo batch completed com lora) -->
      @if (lastCompleted) {
        <div class="current-version">
          <div class="cv-label">Batch mais recente concluído</div>
          <div class="cv-version">{{ lastCompleted.new_lora_version ?? lastCompleted.id }}</div>
          @if (lastCompleted.eval_accuracy) {
            <div class="cv-accuracy">{{ lastCompleted.eval_accuracy | percent:'1.1-1' }}</div>
          }
          @if (lastCompleted.completed_at) {
            <div class="cv-date">Concluído em {{ lastCompleted.completed_at | date:'dd/MM/yyyy' }}</div>
          }
        </div>
      }

      <!-- Gráfico de evolução -->
      @if (batches.length > 0) {
        <div class="chart-section">
          <h2>Evolução dos ciclos</h2>
          <div class="accuracy-chart">
            @for (b of batches; track b.id) {
              <div class="chart-col">
                <div class="chart-bar-wrap">
                  @if (b.eval_accuracy) {
                    <span class="chart-pct">{{ b.eval_accuracy | percent:'1.0-0' }}</span>
                  }
                  <div class="chart-bar"
                    [style.height]="barHeight(b.eval_accuracy) + 'px'"
                    [class.completed]="b.status === 'completed'"
                    [class.failed]="b.status === 'failed'">
                  </div>
                </div>
                <div class="chart-label">{{ (b.new_lora_version ?? b.id).slice(0, 8) }}</div>
                <div class="chart-status">
                  {{ b.status === 'completed' ? '✅' : b.status === 'failed' ? '❌' : b.status === 'running' ? '🔄' : '—' }}
                </div>
              </div>
            }
          </div>
          <div class="threshold-line">
            <span>70% (mínimo recomendado)</span>
          </div>
        </div>
      }

      <!-- Tabela comparativa -->
      @if (batches.length > 1) {
        <div class="comparison-table">
          <h2>Comparação entre ciclos</h2>
          <table>
            <thead>
              <tr>
                <th>ID / LoRA</th>
                <th>Exemplos</th>
                <th>Loss</th>
                <th>Acurácia</th>
                <th>Δ vs anterior</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (b of batches; track b.id; let i = $index) {
                <tr>
                  <td><strong>{{ (b.new_lora_version ?? b.id).slice(0, 8) }}</strong></td>
                  <td>{{ b.total_examples ?? '—' }}</td>
                  <td>{{ b.training_loss != null ? b.training_loss.toFixed(4) : '—' }}</td>
                  <td>{{ b.eval_accuracy != null ? (b.eval_accuracy | percent:'1.1-1') : '—' }}</td>
                  <td>
                    @if (i < batches.length - 1 && batches[i].eval_accuracy != null && batches[i + 1].eval_accuracy != null) {
                      <span [class.positive]="delta(i) > 0" [class.negative]="delta(i) < 0">
                        {{ delta(i) > 0 ? '+' : '' }}{{ (delta(i) * 100).toFixed(1) }}%
                      </span>
                    } @else {
                      <span class="base">base</span>
                    }
                  </td>
                  <td><span class="status-pill" [class]="'s-' + b.status">{{ b.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (batches.length === 0 && !loading) {
        <div class="empty-state">
          <p>Nenhum ciclo de treinamento encontrado.</p>
        </div>
      }
    </div>
  `,
  styleUrls: ['./model-performance.component.scss'],
})
export class ModelPerformanceComponent implements OnInit {
  private trainingService = inject(TrainingService);

  batches: TrainingBatch[] = [];
  loading = true;

  get lastCompleted(): TrainingBatch | null {
    return this.batches.find(b => b.status === 'completed') ?? null;
  }

  ngOnInit(): void {
    this.trainingService.getBatches().subscribe(b => {
      this.batches = b;
      this.loading = false;
    });
  }

  barHeight(acc: number | null): number {
    if (acc == null) return 8;
    return Math.max(8, acc * 160);
  }

  delta(i: number): number {
    if (i >= this.batches.length - 1) return 0;
    const a = this.batches[i].eval_accuracy;
    const b = this.batches[i + 1].eval_accuracy;
    if (a == null || b == null) return 0;
    return a - b;
  }
}
