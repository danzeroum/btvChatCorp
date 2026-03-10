import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface DataQualityMetrics {
  totalInteractions: number;
  positiveRating: number;
  negativeRating: number;
  withCorrection: number;
  approvedForTraining: number;
  rejectedCount: number;
  piiDetectedRate: number;
  avgResponseLength: number;
}

@Component({
  selector: 'app-data-quality',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="data-quality">
      <h3>Métricas de Qualidade dos Dados</h3>
      @if (metrics) {
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="value">{{ metrics.totalInteractions | number }}</span>
            <span class="label">Total de interações</span>
          </div>
          <div class="metric-card positive">
            <span class="value">{{ metrics.positiveRating | number }}</span>
            <span class="label">👍 Aprovadas</span>
          </div>
          <div class="metric-card negative">
            <span class="value">{{ metrics.negativeRating | number }}</span>
            <span class="label">👎 Negativas</span>
          </div>
          <div class="metric-card gold">
            <span class="value">{{ metrics.withCorrection | number }}</span>
            <span class="label">✏️ Com correção (ouro)</span>
          </div>
          <div class="metric-card approved">
            <span class="value">{{ metrics.approvedForTraining | number }}</span>
            <span class="label">✅ Aprovadas p/ treino</span>
          </div>
          <div class="metric-card pii">
            <span class="value">{{ (metrics.piiDetectedRate * 100).toFixed(1) }}%</span>
            <span class="label">🔒 Taxa PII detectado</span>
          </div>
        </div>
      } @else {
        <p>Carregando métricas...</p>
      }
    </div>
  `
})
export class DataQualityComponent implements OnInit {
  private http = inject(HttpClient);
  metrics: DataQualityMetrics | null = null;

  ngOnInit(): void {
    this.http.get<DataQualityMetrics>('/api/admin/training/quality-metrics')
      .subscribe(m => this.metrics = m);
  }
}
