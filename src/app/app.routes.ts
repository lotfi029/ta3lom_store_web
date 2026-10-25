import { Routes } from '@angular/router';
import { cartNotEmptyGuard, customerGuard, guestOnlyGuard } from './core/guards/guards';
import { PublicLayout } from './layout/public-layout/public-layout';

const placeholder = () =>
  import('./features/store/placeholder/placeholder.page').then((m) => m.PlaceholderPage);

/**
 * D-W3: every path sits under /{ar,en} (the locale build's base href); there is no /store prefix (ADR-S09).
 * `/` is home + listing (?q&category&sort&page), `/p/:slug` a project; r4's catalogue and search routes are gone (D-W4).
 */
export const routes: Routes = [
  // The staff admin has its own shell; it must come before the storefront's catch-all.
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    component: PublicLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/store/home/home.page').then((m) => m.HomePage),
      },
      { path: 'cart', loadComponent: placeholder },
      { path: 'checkout', canActivate: [cartNotEmptyGuard], loadComponent: placeholder },
      { path: 'orders/:ref', loadComponent: placeholder },
      {
        path: 'account',
        canActivate: [customerGuard],
        children: [{ path: '**', loadComponent: placeholder }],
      },
      {
        path: 'login',
        canActivate: [guestOnlyGuard],
        loadComponent: () => import('./features/store/login/login.page').then((m) => m.LoginPage),
      },
      { path: 'p/:slug', loadComponent: placeholder },
      {
        path: '**',
        loadComponent: () =>
          import('./features/store/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
