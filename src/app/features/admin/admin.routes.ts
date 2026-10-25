import type { Routes } from '@angular/router';
import { staffGuard, staffPolicyGuard, staffSessionGuard } from '../../core/guards/guards';

const placeholder = () => import('./ui/admin-placeholder').then((m) => m.AdminPlaceholder);

/** `/admin/…`: client-rendered, noindex, outside the storefront layout. */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/admin-login.page').then((m) => m.AdminLoginPage),
  },
  { path: 'password', canActivate: [staffSessionGuard], loadComponent: placeholder },
  {
    path: '',
    canActivate: [staffGuard],
    loadComponent: () => import('./shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: placeholder },
      { path: 'projects', loadComponent: placeholder },
      { path: 'projects/:id', loadComponent: placeholder },
      { path: 'categories', loadComponent: placeholder },
      { path: 'media', loadComponent: placeholder },
      { path: 'orders', loadComponent: placeholder },
      { path: 'orders/:ref', loadComponent: placeholder },
      { path: 'donors', loadComponent: placeholder },
      { path: 'donors/:id', loadComponent: placeholder },
      {
        path: 'staff',
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./staff/staff.page').then((m) => m.StaffPage),
      },
      {
        path: 'settings',
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'templates',
        canActivate: [staffPolicyGuard('staff:templates')],
        loadComponent: () => import('./templates/templates.page').then((m) => m.TemplatesPage),
      },
      {
        path: 'audit',
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./audit/audit.page').then((m) => m.AuditPage),
      },
    ],
  },
];
