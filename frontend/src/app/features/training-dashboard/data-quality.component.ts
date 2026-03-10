import {
  Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

export interface DataQualityMetrics {
  totalInteractions: number;
  positiveRating: number;
  negativeRating: number;
  withCorrection: number;
  pendingCuration: number;
  approvedForTraining: number;
  rejectedCount: number;
  avgResponseLength: number;
  piiDetectedPct: number;
  eligibleForTrainingPct: number;
  byClassification: Record<string, number>;
  bySource: Record<string, number>;
  weeklyTrend: { week: string; count: number; approved: number }[];
}

@Component({
  selector: 'app-data-quality',
  standalone: true,
  imports: [CommonModule, DecimalPipe, PercentPipe],
  template: `
    <div class="data-quality">
      <h3>&#128202; Métricas de Qualidade dos Dados</h3>

      @if (loading()) {
        <div class="loading">Carregando métricas...</div>
      } @else if (metrics()) {
        <div class="metrics-grid">

          <!-- Card: Total de interações -->
          <div class="metric-card">
            <span class="metric-icon">&#128172;</span>
            <span class="metric-value">{{ metrics()!.totalInteractions | number }}</span>
            <span class="metric-label">Total de interações</span>
          </div>

          <!-- Card: Aprovados -->
          <div class="metric-card success">
            <span class="metric-icon">&#9989;</span>
            <span class="metric-value">{{ metrics()!.approvedForTraining | number }}</span>
            <span class="metric-label">Aprovados para treino</span>
          </div>

          <!-- Card: Com correção -->
          <div class="metric-card gold">
            <span class="metric-icon">&#127381;</span>
            <span class="metric-value">{{ metrics()!.withCorrection | number }}</span>
            <span class="metric-label">Com correção manual (ouro)</span>
          </div>

          <!-- Card: PII -->
          <div class="metric-card warning">
            <span class="metric-icon">&#9888;&#65039;</span>
            <span class="metric-value">{{ metrics()!.piiDetectedPct | percent:'1.1-1' }}</span>
            <span class="metric-label">Com PII detectado</span>
          </div>

          <!-- Card: Elegíveis -->
          <div class="metric-card info">
            <span class="metric-icon">&#127919;</span>
            <span class="metric-value">{{ metrics()!.eligibleForTrainingPct | percent:'1.1-1' }}</span>
            <span class="metric-label">Elegíveis para treino</span>
          </div>

          <!-- Card: Rejeitados -->
          <div class="metric-card danger">
            <span class="metric-icon">&#10060;</span>
            <span class="metric-value">{{ metrics()!.rejectedCount | number }}</span>
            <span class="metric-label">Rejeitados</span>
          </div>
        </div>

        <!-- Por classificação -->
        <div class="breakdown-section">
          <h4>Por Classificação</h4>
          <div class="breakdown-bars">
            @for (entry of classificationEntries(); track entry[0]) {
              <div class="bar-row">
                <span class="bar-label">{{ entry[0] }}</span>
                <div class="bar-track">
                  <div class="bar-fill" [class]="entry[0].toLowerCase()"
                    [style.width.%]="(entry[1] / metrics()!.totalInteractions) * 100">
                  </div>
                </div>
                <span class="bar-count">{{ entry[1] }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Tendência semanal -->
        <div class="trend-section">
          <h4>Tendência Semanal</h4>
          <table class="trend-table">
            <thead>
              <tr><th>Semana</th><th>Coletados</th><th>Aprovados</th><th>Taxa</th></tr>
            </thead>
            <tbody>
              @for (row of metrics()!.weeklyTrend; track row.week) {
                <tr>
                  <td>{{ row.week }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.approved }}</td>
                  <td>{{ row.count > 0 ? ((row.approved / row.count) | percent:'1.0-0') : '-' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class DataQualityComponent implements OnInit {
  private http = inject(HttpClient);
  private workspaceCtx = inject(WorkspaceContextService);

  loading = signal(true);
  metrics = signal<DataQualityMetrics | null>(null);

  classificationEntries = () =>
    Object.entries(this.metrics()?.byClassification ?? {}).sort((a, b) => b[1] - a[1]);

  ngOnInit(): void {
    const wsId = this.workspaceCtx.workspaceId();
    this.http
      .get<DataQualityMetrics>(`/api/admin/workspaces/${wsId}/training/quality`)
      .subscribe({
        next: (m) => { this.metrics.set(m); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }
}
