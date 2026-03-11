import { Routes } from '@angular/router';

export const TRAINING_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'feedback-review',
    pathMatch: 'full',
  },
  {
    path: 'feedback-review',
    loadComponent: () =>
      import('./feedback-review/feedback-review.component').then(
        (m) => m.FeedbackReviewComponent,
      ),
  },
  {
    path: 'data-quality',
    loadComponent: () =>
      import('./data-quality/data-quality.component').then(
        (m) => m.DataQualityComponent,
      ),
  },
  {
    path: 'training-queue',
    loadComponent: () =>
      import('./training-queue/training-queue.component').then(
        (m) => m.TrainingQueueComponent,
      ),
  },
  {
    path: 'model-performance',
    loadComponent: () =>
      import('./model-performance/model-performance.component').then(
        (m) => m.ModelPerformanceComponent,
      ),
  },
];
