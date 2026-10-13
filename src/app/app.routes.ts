import { Routes } from '@angular/router';
import { PublicLayout } from './layout/public-layout/public-layout';

/** Plan §2.2. Every path sits under /{ar,en} (the locale build's base href); there is no /store prefix (ADR-S09). */
export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', loadComponent: () => import('./features/store/home/home.page').then((m) => m.HomePage) },
      { path: '**', loadComponent: () => import('./features/store/not-found/not-found.page').then((m) => m.NotFoundPage) },
    ],
  },
];
