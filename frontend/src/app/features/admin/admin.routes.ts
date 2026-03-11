import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./user-management/user-management.component').then((m) => m.UserManagementComponent),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./audit-log-viewer/audit-log-viewer.component').then((m) => m.AuditLogViewerComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./workspace-settings/workspace-settings.component').then((m) => m.WorkspaceSettingsComponent),
  },
  {
    path: 'api-keys',
    loadComponent: () =>
      import('./api-keys/api-keys.component').then((m) => m.ApiKeysComponent),
  },
  {
    path: 'sso',
    loadComponent: () =>
      import('./sso-config/sso-config.component').then((m) => m.SsoConfigComponent),
  },
];
