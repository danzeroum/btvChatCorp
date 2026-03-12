// src/app/app.routes.ts — SUBSTITUIR O ATUAL

import { Routes } from '@angular/router';

export const routes: Routes = [
  // Auth (sem shell)
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ]
  },

  // App (com shell)
  {
    path: '',
    loadComponent: () => import('./core/layout/app-shell.component').then(m => m.AppShellComponent),
    // TODO: canActivate: [authGuard],
    children: [
      // Chat rápido (sem projeto)
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat-container.component').then(m => m.ChatContainerComponent),
      },

      // Projetos
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

      // Documentos
      {
        path: 'documents',
        loadComponent: () => import('./features/documents/document-viewer.component').then(m => m.DocumentViewerComponent),
      },

      // Treinamento
      {
        path: 'training',
        loadChildren: () => import('./features/training-dashboard/training-dashboard.routes').then(m => m.TRAINING_ROUTES),
      },

      // Admin
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },

      // Default
      { path: '', redirectTo: 'chat', pathMatch: 'full' },
    ]
  },

  { path: '**', redirectTo: '/chat' },
];