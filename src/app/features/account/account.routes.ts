import type { Routes } from '@angular/router';

/** `/account/…` (plan §2.2): client-rendered, noindex, signed-in customers only (guard on the parent). */
export const ACCOUNT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'courses' },
  { path: 'courses', loadComponent: () => import('./courses.page').then((m) => m.CoursesPage) },
  { path: 'books', loadComponent: () => import('./books.page').then((m) => m.BooksPage) },
  { path: 'orders', loadComponent: () => import('./orders.page').then((m) => m.OrdersPage) },
  {
    path: 'orders/:ref',
    loadComponent: () => import('./order-detail.page').then((m) => m.OrderDetailPage),
  },
  { path: 'profile', loadComponent: () => import('./profile.page').then((m) => m.ProfilePage) },
];
