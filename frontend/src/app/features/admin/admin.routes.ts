import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full',
  },
  {
    path: 'overview',
    loadComponent: () =>
      import('./overview/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
  },
  // USUÁRIOS
  {
    path: 'users',
    loadComponent: () =>
      import('./users/user-list.component').then((m) => m.UserListComponent),
  },
  {
    path: 'users/roles',
    loadComponent: () =>
      import('./users/permission-matrix.component').then((m) => m.PermissionMatrixComponent),
  },
  {
    path: 'users/:id',
    loadComponent: () =>
      import('./users/user-detail.component').then((m) => m.UserDetailComponent),
  },
  // SEGURANÇA
  {
    path: 'security/audit',
    loadComponent: () =>
      import('./security/audit-log.component').then((m) => m.AuditLogComponent),
  },
  {
    path: 'security/compliance',
    loadComponent: () =>
      import('./security/compliance-report.component').then((m) => m.ComplianceReportComponent),
  },
  {
    path: 'security/sessions',
    loadComponent: () =>
      import('./security/active-sessions.component').then((m) => m.ActiveSessionsComponent),
  },
  // BILLING
  {
    path: 'billing',
    loadComponent: () =>
      import('./billing/usage-overview.component').then((m) => m.UsageOverviewComponent),
  },
  {
    path: 'billing/costs',
    loadComponent: () =>
      import('./billing/cost-breakdown.component').then((m) => m.CostBreakdownComponent),
  },
  {
    path: 'billing/limits',
    loadComponent: () =>
      import('./billing/resource-limits.component').then((m) => m.ResourceLimitsComponent),
  },
  // INTEGRAÇÕES
  {
    path: 'integrations/api-keys',
    loadComponent: () =>
      import('./integrations/api-keys.component').then((m) => m.ApiKeysComponent),
  },
  {
    path: 'integrations/webhooks',
    loadComponent: () =>
      import('./integrations/webhooks-config.component').then((m) => m.WebhooksConfigComponent),
  },
  {
    path: 'integrations/webhooks/:webhookId/logs',
    loadComponent: () =>
      import('./integrations/webhook-logs.component').then((m) => m.WebhookLogsComponent),
  },
  {
    path: 'integrations/docs',
    loadComponent: () =>
      import('./integrations/api-docs-viewer.component').then((m) => m.ApiDocsViewerComponent),
  },
  // WHITE-LABEL
  {
    path: 'white-label',
    loadComponent: () =>
      import('./white-label/components/branding-config.component').then((m) => m.BrandingConfigComponent),
  },
  // CONFIGURAÇÕES
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/workspace-general.component').then((m) => m.WorkspaceGeneralComponent),
  },
];
