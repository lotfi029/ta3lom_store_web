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
        loadComponent: () => import('./ops/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'products',
        loadComponent: () => import('./catalog/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./catalog/product-editor.page').then((m) => m.ProductEditorPage),
      },
      {
        path: 'categories',
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
        path: 'shipments',
        loadComponent: () => import('./ops/shipments.page').then((m) => m.ShipmentsPage),
      },
      { path: 'stock', loadComponent: () => import('./ops/stock.page').then((m) => m.StockPage) },
      {
        path: 'customers',
        loadComponent: () => import('./ops/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'reports',
        canActivate: [staffPolicyGuard('staff:finance')],
        loadComponent: () => import('./ops/reports.page').then((m) => m.ReportsPage),
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
