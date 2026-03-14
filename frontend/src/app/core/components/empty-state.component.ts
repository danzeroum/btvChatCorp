import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente de empty-state reutilizavel.
 *
 * Uso:
 *   <app-empty-state
 *     icon="📭"
 *     title="Nenhum item encontrado"
 *     description="Adicione um item para comecar."
 *     actionLabel="Adicionar"
 *     (action)="onCreate()" />
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state" [class]="'empty-state--' + size" role="status" aria-live="polite">
      @if (icon) {
        <div class="empty-icon">{{ icon }}</div>
      }
      <h3 class="empty-title">{{ title }}</h3>
      @if (description) {
        <p class="empty-description">{{ description }}</p>
      }
      @if (actionLabel) {
        <button class="btn-primary empty-action" (click)="action.emit()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
      color: #6b7280;
    }
    .empty-state--sm { padding: 1.5rem 1rem; }
    .empty-state--lg { padding: 5rem 3rem; }
    .empty-icon  { font-size: 3rem; margin-bottom: 1rem; }
    .empty-title { font-size: 1.1rem; font-weight: 600; color: #374151; margin: 0 0 .5rem; }
    .empty-description { font-size: .9rem; margin: 0 0 1.5rem; max-width: 360px; }
    .empty-action { margin-top: .5rem; }
  `],
})
export class EmptyStateComponent {
  @Input() icon        = '';
  @Input() title       = 'Nenhum item encontrado';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  readonly action = new (require('@angular/core').EventEmitter)();
}
