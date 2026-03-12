import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/chat/chat-container.component').then(m => m.ChatContainerComponent)
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./features/document-manager/document-manager.component').then(m => m.DocumentManagerComponent)
  },
  {
    path: 'training',
    loadComponent: () =>
      import('./features/training-dashboard/training-dashboard.component').then(m => m.TrainingDashboardComponent)
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  { path: '**', redirectTo: '' }
];
