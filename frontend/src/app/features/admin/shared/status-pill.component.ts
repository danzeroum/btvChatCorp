import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  template: `
    <span class="pill" [class]="'pill-' + kind">
      <span class="dot"></span>
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pill-ok      { background: var(--good-soft); color: var(--good); }
    .pill-ok .dot { background: var(--good); }
    .pill-warn      { background: #faf3e6; color: var(--warn); }
    .pill-warn .dot { background: var(--warn); }
    .pill-bad      { background: var(--acc-soft); color: var(--acc); }
    .pill-bad .dot { background: var(--acc); }
    .pill-neutral      { background: var(--panel-2); color: var(--ink-3); }
    .pill-neutral .dot { background: var(--ink-3); }
  `]
})
export class StatusPillComponent {
  @Input() kind: 'ok' | 'warn' | 'bad' | 'neutral' = 'neutral';
}
