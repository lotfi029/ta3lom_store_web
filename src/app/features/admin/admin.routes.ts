import type { Routes } from '@angular/router';
import { staffGuard, staffPolicyGuard } from '../../core/guards/guards';

/** `/admin/…` (plan §2.2, W-08…W-10): client-rendered, noindex, outside the storefront layout. */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/admin-login.page').then((m) => m.AdminLoginPage),
  },
  {
    path: '',
    canActivate: [staffGuard],
    loadComponent: () => import('./shell/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home/admin-home.page').then((m) => m.AdminHomePage),
      },
      {
        path: 'staff',
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./staff/staff.page').then((m) => m.StaffPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'templates',
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
