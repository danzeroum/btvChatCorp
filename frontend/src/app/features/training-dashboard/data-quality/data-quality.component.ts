import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingService, TrainingInteraction } from '../training.service';

/**
 * DataQualityComponent
 * Calcula metricas localmente a partir da lista de interacoes.
 * O backend nao expoe um endpoint /training/quality separado;
 * os dados sao derivados de GET /training/queue.
 */
@Component({
  selector: 'app-data-quality',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="data-quality">
      <h1>Qualidade dos Dados</h1>
      <p class="subtitle">Métricas de saúde do dataset de treinamento</p>

      @if (loading) {
        <div class="loading">Carregando métricas...</div>
      } @else {
        <!-- KPIs principais -->
        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value">{{ total }}</span>
            <span class="kpi-label">Total de interações</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ approved }}</span>
            <span class="kpi-label">Aprov. para treino</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ pending }}</span>
            <span class="kpi-label">Pendentes</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ corrected }}</span>
            <span class="kpi-label">Com correção</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ approvalRate | percent:'1.0-1' }}</span>
            <span class="kpi-label">Taxa de aprovação</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ correctionRate | percent:'1.0-1' }}</span>
            <span class="kpi-label">Taxa de correção</span>
          </div>
        </div>

        <!-- Por rating -->
        <div class="section">
          <h2>Por avaliação do usuário</h2>
          <div class="bar-chart">
            @for (entry of ratingEntries; track entry.key) {
              <div class="bar-row">
                <span class="bar-label">{{ ratingLabel(entry.key) }}</span>
                <div class="bar-track">
                  <div class="bar-fill" [style.width]="barWidth(entry.value, maxRating)"></div>
                </div>
                <span class="bar-value">{{ entry.value }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Por classificação -->
        <div class="section">
          <h2>Por classificação de dados</h2>
          <div class="classification-grid">
            @for (entry of classEntries; track entry.key) {
              <div class="class-card" [class]="'class-' + entry.key.toLowerCase()">
                <span class="class-value">{{ entry.value }}</span>
                <span class="class-label">{{ entry.key }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./data-quality.component.scss'],
})
export class DataQualityComponent implements OnInit {
  private trainingService = inject(TrainingService);

  items: TrainingInteraction[] = [];
  loading = true;

  get total(): number    { return this.items.length; }
  get approved(): number { return this.items.filter(i => i.curator_status === 'approved').length; }
  get pending(): number  { return this.items.filter(i => i.curator_status === 'pending').length; }
  get corrected(): number { return this.items.filter(i => !!i.user_correction).length; }

  get approvalRate(): number {
    return this.total > 0 ? this.approved / this.total : 0;
  }
  get correctionRate(): number {
    return this.total > 0 ? this.corrected / this.total : 0;
  }

  get ratingEntries(): { key: string; value: number }[] {
    const map: Record<string, number> = { positive: 0, negative: 0, none: 0 };
    this.items.forEach(i => {
      const k = i.user_rating ?? 'none';
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).map(([key, value]) => ({ key, value }));
  }

  get maxRating(): number {
    return Math.max(1, ...this.ratingEntries.map(e => e.value));
  }

  get classEntries(): { key: string; value: number }[] {
    const map: Record<string, number> = {};
    this.items.forEach(i => {
      map[i.data_classification] = (map[i.data_classification] ?? 0) + 1;
    });
    return Object.entries(map).map(([key, value]) => ({ key, value }));
  }

  ngOnInit(): void {
    this.trainingService.getQueue().subscribe(items => {
      this.items = items;
      this.loading = false;
    });
  }

  barWidth(value: number, max: number): string {
    return `${(value / (max || 1)) * 100}%`;
  }

  ratingLabel(s: string): string {
    return { positive: '👍 Positivos', negative: '👎 Negativos', none: '— Sem rating' }[s] ?? s;
  }
}
