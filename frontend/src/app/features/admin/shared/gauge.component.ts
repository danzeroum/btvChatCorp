import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gauge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gauge-wrap">
      <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
        <!-- Track -->
        <circle cx="55" cy="55" r="46"
                fill="none" stroke="var(--line-2)" stroke-width="11"/>
        <!-- Fill -->
        <circle cx="55" cy="55" r="46"
                fill="none"
                [attr.stroke]="color"
                stroke-width="11"
                stroke-linecap="round"
                [attr.stroke-dasharray]="circumference"
                [attr.stroke-dashoffset]="offset"
                transform="rotate(-90 55 55)"/>
      </svg>
      <div class="gauge-inner">
        <span class="gauge-value mono">{{ value }}%</span>
        @if (sub) { <span class="gauge-sub">{{ sub }}</span> }
      </div>
    </div>
  `,
  styles: [`
    .gauge-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 110px;
      height: 110px;
    }
    .gauge-inner {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .gauge-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.01em;
    }
    .gauge-sub {
      font-size: 10.5px;
      color: var(--ink-3);
      text-align: center;
      line-height: 1.3;
    }
    .mono { font-family: 'IBM Plex Mono', monospace; }
  `]
})
export class GaugeComponent {
  @Input() value = 0;
  @Input() sub = '';
  @Input() color = 'var(--acc)';

  readonly circumference = 2 * Math.PI * 46;

  get offset(): number {
    return this.circumference * (1 - Math.min(100, Math.max(0, this.value)) / 100);
  }
}
