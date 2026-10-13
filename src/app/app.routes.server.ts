import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Plan §2.2: public catalogue pages are prerendered; cart, checkout, login, thanks, search, account, admin and 404
 * are client-rendered (served from index.csr.html by the host's fallback).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
