import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface VersionComparison {
  versionA: string;
  versionB: string;
  metrics: {
    label: string;
    valueA: number;
    valueB: number;
    unit: string;
    higherIsBetter: boolean;
  }[];
}

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="model-performance">
      <h3>Performance do Modelo</h3>
      @if (comparison) {
        <p class="comparison-title">
          Comparando <strong>{{ comparison.versionA }}</strong>
          vs <strong>{{ comparison.versionB }}</strong>
        </p>
        <table class="perf-table">
          <thead>
            <tr><th>Métrica</th><th>{{ comparison.versionA }}</th><th>{{ comparison.versionB }}</th><th>Delta</th></tr>
          </thead>
          <tbody>
            @for (m of comparison.metrics; track m.label) {
              <tr>
                <td>{{ m.label }}</td>
                <td>{{ m.valueA }}{{ m.unit }}</td>
                <td>{{ m.valueB }}{{ m.unit }}</td>
                <td [class]="getDeltaClass(m)">
                  {{ getDelta(m) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p>Carregando comparação...</p>
      }
    </div>
  `
})
export class ModelPerformanceComponent implements OnInit {
  private http = inject(HttpClient);
  comparison: VersionComparison | null = null;

  ngOnInit(): void {
    this.http.get<VersionComparison>('/api/admin/training/performance')
      .subscribe(c => this.comparison = c);
  }

  getDelta(m: VersionComparison['metrics'][0]): string {
    const delta = m.valueB - m.valueA;
    return (delta >= 0 ? '+' : '') + delta.toFixed(1) + m.unit;
  }

  getDeltaClass(m: VersionComparison['metrics'][0]): string {
    const delta = m.valueB - m.valueA;
    const improved = m.higherIsBetter ? delta > 0 : delta < 0;
    return improved ? 'improved' : delta === 0 ? 'neutral' : 'degraded';
  }
}
