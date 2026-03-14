import { Routes } from '@angular/router';
import { adminGuard } from '../auth/admin.guard';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },
  {
    path: 'users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./user-management/user-management.component').then(m => m.UserManagementComponent),
  },
  {
    path: 'audit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./audit-log-viewer/audit-log-viewer.component').then(m => m.AuditLogViewerComponent),
  },
  {
    path: 'settings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./workspace-settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent),
  },
  {
    path: 'api-keys',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./api-keys/api-keys.component').then(m => m.ApiKeysComponent),
  },
  {
    path: 'sso',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./sso-config/sso-config.component').then(m => m.SsoConfigComponent),
  },
  {
    path: 'ai-config',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./ai-config/model-manager.component').then(m => m.ModelManagerComponent),
  },
];
