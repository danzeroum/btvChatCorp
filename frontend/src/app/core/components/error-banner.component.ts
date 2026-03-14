import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Banner de erro inline reutilizavel.
 *
 * Uso:
 *   <app-error-banner [message]="error" (dismiss)="error = null" />
 *   <app-error-banner message="Falha ao salvar" severity="warning" />
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (message) {
      <div
        class="error-banner"
        [class]="'error-banner--' + severity"
        role="alert"
        aria-live="assertive">
        <span class="error-icon">{{ severityIcon }}</span>
        <span class="error-message">{{ message }}</span>
        @if (dismissible) {
          <button
            class="error-dismiss"
            (click)="dismiss.emit()"
            aria-label="Fechar mensagem de erro">
            &times;
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .error-banner {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: .9rem;
    }
    .error-banner--error   { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
    .error-banner--warning { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
    .error-banner--info    { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
    .error-message { flex: 1; }
    .error-dismiss {
      background: none; border: none; cursor: pointer;
      font-size: 1.2rem; line-height: 1; padding: 0;
      color: inherit; opacity: .7;
    }
    .error-dismiss:hover { opacity: 1; }
  `],
})
export class ErrorBannerComponent {
  @Input() message    : string | null = null;
  @Input() severity   : 'error' | 'warning' | 'info' = 'error';
  @Input() dismissible = true;
  @Output() dismiss    = new EventEmitter<void>();

  get severityIcon(): string {
    return { error: '\u274c', warning: '\u26a0\ufe0f', info: '\u2139\ufe0f' }[this.severity] ?? '\u274c';
  }
}
