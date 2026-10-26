import type { Routes } from '@angular/router';

/** `/account/…` (W-M4): donations (list + detail) and profile; the empty path opens the donations. */
export const ACCOUNT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'donations' },
  {
    path: 'donations',
    loadComponent: () => import('./donations.page').then((m) => m.DonationsPage),
  },
  {
    path: 'donations/:ref',
    loadComponent: () => import('./donation-detail.page').then((m) => m.DonationDetailPage),
  },
  { path: 'profile', loadComponent: () => import('./profile.page').then((m) => m.ProfilePage) },
];
