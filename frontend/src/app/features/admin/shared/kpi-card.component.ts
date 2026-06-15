import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card">
      <span class="kpi-label">{{ label }}</span>
      <span class="kpi-value mono">{{ value }}</span>
      @if (trend) {
        <span class="kpi-trend mono"
              [class.trend-up]="trendDir === 'up'"
              [class.trend-down]="trendDir === 'down'"
              [class.trend-warn]="trendDir === 'warn'">
          {{ trend }}
        </span>
      }
    </div>
  `,
  styles: [`
    .kpi-card {
      background: var(--white);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 15px 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpi-label {
      font-size: 11.5px;
      color: var(--ink-3);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .kpi-value {
      font-size: 25px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.01em;
      line-height: 1.15;
    }
    .kpi-trend {
      font-size: 11px;
      font-weight: 500;
      margin-top: 2px;
    }
    .trend-up   { color: var(--good); }
    .trend-down { color: var(--acc); }
    .trend-warn { color: var(--warn); }
    .mono { font-family: 'IBM Plex Mono', monospace; }
  `]
})
export class KpiCardComponent {
  @Input() value: string | number = '';
  @Input() label = '';
  @Input() trend?: string;
  @Input() trendDir?: 'up' | 'down' | 'warn';
}
