import { Routes } from '@angular/router';
import { authGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  // Auth (sem shell, sem guard)
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ]
  },

  // App (com shell, protegido)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell.component').then(m => m.AppShellComponent),
    children: [
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat-container.component').then(m => m.ChatContainerComponent),
      },
      {
        path: 'projects',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/projects/project-list.component').then(m => m.ProjectListComponent),
          },
          {
            path: 'new',
            loadComponent: () => import('./features/projects/project-create.component').then(m => m.ProjectCreateComponent),
          },
          {
            path: ':id',
            loadComponent: () => import('./features/projects/project-workspace.component').then(m => m.ProjectWorkspaceComponent),
          },
          {
            path: ':id/chat/:chatId',
            loadComponent: () => import('./features/projects/project-chat.component').then(m => m.ProjectChatComponent),
          },
        ]
      },
      {
        path: 'documents',
        loadComponent: () => import('./features/documents/document-viewer.component').then(m => m.DocumentViewerComponent),
      },
      {
        path: 'training',
        loadChildren: () => import('./features/training-dashboard/training-dashboard.routes').then(m => m.TRAINING_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },
      { path: '', redirectTo: 'projects', pathMatch: 'full' },
    ]
  },

  { path: '**', redirectTo: '/auth/login' },
];
