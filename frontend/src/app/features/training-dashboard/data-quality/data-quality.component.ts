import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, DataQualityMetrics } from '../training.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-data-quality',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="data-quality" *ngIf="metrics">
      <h1>Qualidade dos Dados</h1>
      <p class="subtitle">Métricas de saúde do dataset de treinamento</p>

      <!-- KPIs principais -->
      <div class="kpi-grid">
        <div class="kpi">
          <span class="kpi-value">{{ metrics.totalInteractions | number }}</span>
          <span class="kpi-label">Total de interações</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ metrics.eligibleForTraining | number }}</span>
          <span class="kpi-label">Elegíveis para treino</span>
        </div>
        <div class="kpi kpi--warn" *ngIf="metrics.piiDetectedCount > 0">
          <span class="kpi-value">{{ metrics.piiDetectedCount }}</span>
          <span class="kpi-label">⚠ Com PII detectado</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ metrics.approvalRate | percent:'1.0-1' }}</span>
          <span class="kpi-label">Taxa de aprovação</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ metrics.correctionRate | percent:'1.0-1' }}</span>
          <span class="kpi-label">Taxa de correção</span>
        </div>
      </div>

      <!-- Por fonte -->
      <div class="section">
        <h2>Por fonte de dados</h2>
        <div class="bar-chart">
          <div *ngFor="let entry of sourceEntries" class="bar-row">
            <span class="bar-label">{{ sourceLabel(entry.key) }}</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width]="barWidth(entry.value)"
                [class]="'bar-' + entry.key"></div>
            </div>
            <span class="bar-value">{{ entry.value }}</span>
          </div>
        </div>
      </div>

      <!-- Por classificação -->
      <div class="section">
        <h2>Por classificação de dados</h2>
        <div class="classification-grid">
          <div *ngFor="let entry of classificationEntries" class="class-card"
            [class]="'class-' + entry.key.toLowerCase()">
            <span class="class-value">{{ entry.value }}</span>
            <span class="class-label">{{ entry.key }}</span>
          </div>
        </div>
      </div>

      <!-- Volume diário (últimos 14 dias) -->
      <div class="section">
        <h2>Volume diário (últimos 14 dias)</h2>
        <div class="sparkline">
          <div *ngFor="let d of metrics.dailyVolume" class="spark-bar"
            [style.height]="sparkHeight(d.count) + 'px'"
            [title]="d.date + ': ' + d.count + ' interações'">
          </div>
        </div>
        <div class="sparkline-labels">
          <span>{{ metrics.dailyVolume[0]?.date | date:'dd/MM' }}</span>
          <span>{{ metrics.dailyVolume[metrics.dailyVolume.length-1]?.date | date:'dd/MM' }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./data-quality.component.scss'],
})
export class DataQualityComponent implements OnInit {
  private trainingService = inject(TrainingService);
  private wsCtx = inject(WorkspaceContextService);

  metrics: DataQualityMetrics | null = null;

  get sourceEntries() {
    return Object.entries(this.metrics?.bySource ?? {}).map(([key, value]) => ({ key, value }));
  }
  get classificationEntries() {
    return Object.entries(this.metrics?.byClassification ?? {}).map(([key, value]) => ({ key, value }));
  }

  ngOnInit() {
    this.trainingService.getDataQuality(this.wsCtx.workspaceId()).subscribe(
      (m) => (this.metrics = m),
    );
  }

  barWidth(value: number): string {
    const max = Math.max(...Object.values(this.metrics?.bySource ?? {}));
    return `${(value / (max || 1)) * 100}%`;
  }

  sparkHeight(count: number): number {
    const max = Math.max(...(this.metrics?.dailyVolume?.map((d) => d.count) ?? [1]));
    return Math.max(4, (count / max) * 80);
  }

  sourceLabel(s: string): string {
    return { user_approved: '👍 Aprovados', user_corrected: '✏ Corrigidos', synthetic_from_docs: '🤖 Sintéticos' }[s] ?? s;
  }
}
