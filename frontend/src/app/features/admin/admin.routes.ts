import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./overview/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./user-management/user-management.component').then(m => m.UserManagementComponent),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./audit-log-viewer/audit-log-viewer.component').then(m => m.AuditLogViewerComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./workspace-settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent),
  },
  {
    path: 'api-keys',
    loadComponent: () =>
      import('./api-keys/api-keys.component').then(m => m.ApiKeysComponent),
  },
  {
    path: 'sso',
    loadComponent: () =>
      import('./sso-config/sso-config.component').then(m => m.SsoConfigComponent),
  },
  {
    path: 'ai-config',
    loadComponent: () =>
      import('./ai-config/model-manager.component').then(m => m.ModelManagerComponent),
  },
  {
    path: 'rag-config',
    loadComponent: () =>
      import('./ai-config/rag-config.component').then(m => m.RagConfigComponent),
  },
  {
    path: 'integrations/webhooks',
    loadComponent: () =>
      import('./integrations/webhooks-config.component').then(m => m.WebhooksConfigComponent),
  },
  {
    path: 'integrations/webhooks/:webhookId/logs',
    loadComponent: () =>
      import('./integrations/webhook-logs.component').then(m => m.WebhookLogsComponent),
  },
  {
    path: 'branding',
    loadComponent: () =>
      import('./white-label/branding-admin-page.component').then(m => m.BrandingAdminPageComponent),
  },
  {
    path: 'billing',
    loadComponent: () =>
      import('./billing/usage-overview.component').then(m => m.UsageOverviewComponent),
  },
];
