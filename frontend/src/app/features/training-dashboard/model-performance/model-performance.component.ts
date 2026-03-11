import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, TrainingBatch } from '../training.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="model-performance">
      <h1>Performance do Modelo</h1>
      <p class="subtitle">Evolução da acurácia ao longo dos ciclos de fine-tuning</p>

      <!-- Versão ativa -->
      <div class="current-version" *ngIf="deployed.length > 0">
        <div class="cv-label">Versão ativa</div>
        <div class="cv-version">{{ deployed[0].version }}</div>
        <div class="cv-accuracy">{{ deployed[0].accuracy | percent:'1.1-1' }}</div>
        <div class="cv-date">Deploy em {{ deployed[0].deployedAt | date:'dd/MM/yyyy' }}</div>
      </div>

      <!-- Gráfico de evolução de acurácia -->
      <div class="chart-section" *ngIf="batches.length > 0">
        <h2>Evolução da acurácia por versão</h2>
        <div class="accuracy-chart">
          <div *ngFor="let b of batches" class="chart-col">
            <div class="chart-bar-wrap">
              <span class="chart-pct">{{ b.accuracy | percent:'1.0-0' }}</span>
              <div class="chart-bar"
                [style.height]="barHeight(b.accuracy) + 'px'"
                [class.deployed]="b.status === 'deployed'"
                [class.rolled-back]="b.status === 'rolled_back'">
              </div>
            </div>
            <div class="chart-label">{{ b.version }}</div>
            <div class="chart-status" [class]="'s-' + b.status">
              {{ b.status === 'deployed' ? '✅' : b.status === 'rolled_back' ? '↩' : '—' }}
            </div>
          </div>
        </div>
        <!-- Linha de threshold mínimo 70% -->
        <div class="threshold-line">
          <span>70% (mínimo para deploy)</span>
        </div>
      </div>

      <!-- Tabela comparativa -->
      <div class="comparison-table" *ngIf="batches.length > 1">
        <h2>Comparação entre versões</h2>
        <table>
          <thead>
            <tr>
              <th>Versão</th><th>Exemplos</th><th>Acurácia</th><th>Δ vs anterior</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of batches; let i = index">
              <td><strong>{{ b.version }}</strong></td>
              <td>{{ b.totalExamples }}</td>
              <td>{{ b.accuracy | percent:'1.1-1' }}</td>
              <td>
                <span *ngIf="i < batches.length - 1" [class.positive]="delta(i) > 0" [class.negative]="delta(i) < 0">
                  {{ delta(i) > 0 ? '+' : '' }}{{ (delta(i) * 100).toFixed(1) }}%
                </span>
                <span *ngIf="i === batches.length - 1" class="base">base</span>
              </td>
              <td><span class="status-pill" [class]="'s-' + b.status">{{ b.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrls: ['./model-performance.component.scss'],
})
export class ModelPerformanceComponent implements OnInit {
  private trainingService = inject(TrainingService);
  private wsCtx = inject(WorkspaceContextService);
  batches: TrainingBatch[] = [];

  get deployed(): TrainingBatch[] {
    return this.batches.filter((b) => b.status === 'deployed');
  }

  ngOnInit() {
    this.trainingService.getBatches(this.wsCtx.workspaceId).subscribe(
      (b) => (this.batches = b),
    );
  }

  barHeight(acc: number): number {
    return Math.max(8, acc * 160);
  }

  delta(i: number): number {
    if (i >= this.batches.length - 1) return 0;
    return this.batches[i].accuracy - this.batches[i + 1].accuracy;
  }
}
