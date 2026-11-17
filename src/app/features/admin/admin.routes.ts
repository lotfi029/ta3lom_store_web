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
        data: { title: $localize`:@@store.admin.nav-home:الرئيسية` },
        loadComponent: () => import('./ops/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        // Phone "More" page (docs/admin-redesign/02 §3); wider screens are sent to /admin.
        path: 'menu',
        data: { title: $localize`:@@store.admin.more:المزيد` },
        loadComponent: () => import('./menu/menu.page').then((m) => m.AdminMenuPage),
      },
      {
        path: 'projects',
        data: { title: $localize`:@@store.admin.nav-projects:المشاريع` },
        loadComponent: () => import('./catalog/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/:id',
        data: { title: $localize`:@@store.admin.route-project:المشروع` },
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./catalog/project-editor.page').then((m) => m.ProjectEditorPage),
      },
      {
        path: 'categories',
        data: { title: $localize`:@@store.admin.nav-categories:التصنيفات` },
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./catalog/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'media',
        data: { title: $localize`:@@store.admin.nav-media:الوسائط` },
        loadComponent: () => import('./catalog/media.page').then((m) => m.MediaPage),
      },
      {
        path: 'orders',
        data: { title: $localize`:@@store.admin.nav-donations:التبرعات` },
        loadComponent: () => import('./ops/orders.page').then((m) => m.AdminOrdersPage),
      },
      {
        path: 'orders/:ref',
        data: { title: $localize`:@@store.admin.route-order:التبرع` },
        loadComponent: () => import('./ops/order.page').then((m) => m.AdminOrderPage),
      },
      {
        path: 'donors',
        data: { title: $localize`:@@store.admin.nav-donors:المتبرعون` },
        loadComponent: () => import('./ops/donors.page').then((m) => m.DonorsPage),
      },
      {
        path: 'donors/:id',
        data: { title: $localize`:@@store.admin.route-donor:المتبرع` },
        loadComponent: () => import('./ops/donor.page').then((m) => m.DonorPage),
      },
      {
        path: 'staff',
        data: { title: $localize`:@@store.admin.nav-staff:فريق العمل` },
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./staff/staff.page').then((m) => m.StaffPage),
      },
      {
        // W-A6: the settings index (team, store settings, templates, audit, password).
        path: 'settings',
        data: { title: $localize`:@@store.admin.nav-settings-team:الإعدادات والفريق` },
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () =>
          import('./settings-home/settings-home.page').then((m) => m.SettingsHomePage),
      },
      {
        path: 'settings/store',
        data: { title: $localize`:@@store.admin.settings-store:إعدادات المتجر` },
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'templates',
        data: { title: $localize`:@@store.admin.nav-templates:قوالب الرسائل` },
        canActivate: [staffPolicyGuard('staff:templates')],
        loadComponent: () => import('./templates/templates.page').then((m) => m.TemplatesPage),
      },
      {
        path: 'reports',
        data: { title: $localize`:@@store.admin.nav-reports:التقارير` },
        canActivate: [staffPolicyGuard('staff:finance')],
        loadComponent: () => import('./reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'payments/orphans',
        data: { title: $localize`:@@store.admin.nav-orphans:دفعات بلا طلب` },
        canActivate: [staffPolicyGuard('staff:finance')],
        loadComponent: () => import('./ops/orphans.page').then((m) => m.OrphansPage),
      },
      {
        path: 'audit',
        data: { title: $localize`:@@store.admin.nav-audit:سجل التدقيق` },
        canActivate: [staffPolicyGuard('staff:admin')],
        loadComponent: () => import('./audit/audit.page').then((m) => m.AuditPage),
      },
    ],
  },
];
