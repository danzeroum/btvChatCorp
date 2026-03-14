import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Skeleton de carregamento reutilizavel.
 *
 * Uso:
 *   <app-skeleton [rows]="3" [height]="'1.5rem'" />
 *   <app-skeleton variant="card" />
 *   <app-skeleton variant="table" [rows]="5" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (variant) {
      @case ('card') {
        <div class="skeleton-card">
          <div class="sk sk-title"></div>
          <div class="sk sk-text"></div>
          <div class="sk sk-text sk-short"></div>
        </div>
      }
      @case ('table') {
        <div class="skeleton-table">
          <div class="sk sk-header"></div>
          @for (_ of rowArr; track $index) {
            <div class="sk sk-row"></div>
          }
        </div>
      }
      @default {
        <div class="skeleton-lines">
          @for (_ of rowArr; track $index) {
            <div class="sk sk-line" [style.height]="height"></div>
          }
        </div>
      }
    }
  `,
  styles: [`
    .sk {
      background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .sk-title  { height: 1.5rem; width: 60%; }
    .sk-text   { height: 1rem;   width: 100%; }
    .sk-short  { width: 40%; }
    .sk-header { height: 2rem;   width: 100%; }
    .sk-row    { height: 1.2rem; width: 100%; }
    .sk-line   { width: 100%; }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    :host([aria-hidden]) { display: none; }
  `],
})
export class LoadingSkeletonComponent {
  @Input() variant: 'lines' | 'card' | 'table' = 'lines';
  @Input() rows    = 3;
  @Input() height  = '1rem';

  get rowArr(): unknown[] { return Array(this.rows); }
}
