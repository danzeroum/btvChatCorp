import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty">
      @if (icon) {
        <div class="empty-icon" aria-hidden="true">{{ icon }}</div>
      }
      <p class="empty-title">{{ title }}</p>
      @if (description) {
        <p class="empty-desc">{{ description }}</p>
      }
      @if (action) {
        <button class="empty-action" (click)="actionClick.emit()">{{ action }}</button>
      }
    </div>
  `,
  styles: [`
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 24px;
      gap: 8px;
      text-align: center;
    }
    .empty-icon { font-size: 28px; margin-bottom: 4px; }
    .empty-title { font-size: 14px; font-weight: 600; color: var(--ink); margin: 0; }
    .empty-desc { font-size: 13px; color: var(--ink-3); margin: 0; max-width: 320px; line-height: 1.5; }
    .empty-action {
      margin-top: 8px;
      padding: 7px 16px;
      background: var(--ink);
      color: #fff;
      border: none;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      &:hover { background: #2c2b28; }
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input() title = '';
  @Input() description = '';
  @Input() action = '';
  @Output() actionClick = new EventEmitter<void>();
}
