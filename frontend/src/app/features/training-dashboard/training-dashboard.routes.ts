import { Routes } from '@angular/router';
import { adminGuard } from '../auth/admin.guard';

/**
 * Rotas do Training Dashboard.
 * Todas protegidas por adminGuard — apenas admins do workspace
 * podem curar dados e iniciar ciclos de treinamento.
 */
export const TRAINING_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'feedback-review',
    pathMatch: 'full',
  },
  {
    path: 'feedback-review',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./feedback-review/feedback-review.component').then(
        (m) => m.FeedbackReviewComponent,
      ),
  },
  {
    path: 'data-quality',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./data-quality/data-quality.component').then(
        (m) => m.DataQualityComponent,
      ),
  },
  {
    path: 'training-queue',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./training-queue/training-queue.component').then(
        (m) => m.TrainingQueueComponent,
      ),
  },
  {
    path: 'model-performance',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./model-performance/model-performance.component').then(
        (m) => m.ModelPerformanceComponent,
      ),
  },
  {
    path: 'batches',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./training-batches/training-batches.component').then(
        (m) => m.TrainingBatchesComponent,
      ),
  },
];
