import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-mini-bar',
  standalone: true,
  template: `
    <div class="bar-track" [style.height]="height">
      <div class="bar-fill"
           [style.width]="fillPct + '%'"
           [style.background]="color">
      </div>
    </div>
  `,
  styles: [`
    .bar-track {
      width: 100%;
      background: var(--line-2);
      border-radius: 999px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.3s ease;
    }
  `]
})
export class MiniBarComponent {
  @Input() value = 0;
  @Input() max = 100;
  @Input() color = 'var(--acc)';
  @Input() height = '6px';

  get fillPct(): number {
    return Math.min(100, Math.max(0, (this.value / (this.max || 1)) * 100));
  }
}
