import type { Routes } from '@angular/router';
import {
  staffGuard,
  staffPolicyGuard,
  staffSessionGuard,
  unsavedChangesGuard,
} from '../../core/guards/guards';

/** `/admin/…`: client-rendered, noindex, outside the storefront layout. */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/admin-login.page').then((m) => m.AdminLoginPage),
  },
  {
    // Forced (pwd_change claim, C-6) or self-service; outside the shell, whose screens are 403 while a change is pending.
    path: 'password',
    canActivate: [staffSessionGuard],
    loadComponent: () => import('./password/admin-password.page').then((m) => m.AdminPasswordPage),
  },
  {
    path: '',
    canActivate: [staffGuard],
    loadComponent: () => import('./shell/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./ops/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        loadComponent: () => import('./catalog/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./catalog/project-editor.page').then((m) => m.ProjectEditorPage),
      },
      {
        path: 'categories',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./catalog/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'media',
        loadComponent: () => import('./catalog/media.page').then((m) => m.MediaPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./ops/orders.page').then((m) => m.AdminOrdersPage),
      },
      {
        path: 'orders/:ref',
        loadComponent: () => import('./ops/order.page').then((m) => m.AdminOrderPage),
      },
      {
        path: 'donors',
        loadComponent: () => import('./ops/donors.page').then((m) => m.DonorsPage),
      },
      {
        path: 'donors/:id',
        loadComponent: () => import('./ops/donor.page').then((m) => m.DonorPage),
      },
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
