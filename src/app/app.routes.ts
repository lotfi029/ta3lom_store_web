import { Routes } from '@angular/router';
import {
  cartNotEmptyGuard,
  customerGuard,
  guestOnlyGuard,
  thanksAccessGuard,
} from './core/guards/guards';
import { PublicLayout } from './layout/public-layout/public-layout';

/** Plan §2.2. Every path sits under /{ar,en} (the locale build's base href); there is no /store prefix (ADR-S09). */
export const routes: Routes = [
  // The staff admin has its own shell (W-08); it must come before the storefront's catch-all.
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
      {
        path: 'courses',
        data: { type: 'course' },
        loadComponent: () =>
          import('./features/store/catalog/catalog.page').then((m) => m.CatalogPage),
      },
      {
        path: 'books',
        data: { type: 'book' },
        loadComponent: () =>
          import('./features/store/catalog/catalog.page').then((m) => m.CatalogPage),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/store/catalog/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/store/cart/cart.page').then((m) => m.CartPage),
      },
      {
        path: 'checkout',
        canActivate: [cartNotEmptyGuard],
        loadComponent: () =>
          import('./features/store/checkout/checkout.page').then((m) => m.CheckoutPage),
      },
      {
        path: 'orders/:ref/thanks',
        canActivate: [thanksAccessGuard],
        loadComponent: () =>
          import('./features/store/thanks/thanks.page').then((m) => m.ThanksPage),
      },
      {
        path: 'account',
        canActivate: [customerGuard],
        loadComponent: () => import('./features/account/account-shell').then((m) => m.AccountShell),
        loadChildren: () =>
          import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'login',
        canActivate: [guestOnlyGuard],
        loadComponent: () => import('./features/store/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'p/:slug',
        loadComponent: () =>
          import('./features/store/product/product.page').then((m) => m.ProductPage),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/store/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
