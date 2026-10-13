import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { PRODUCT_SLUGS } from './prerender-manifest';

/**
 * Plan §2.2/§2.5: home and the two catalogues are prerendered; every product slug known at build time
 * (scripts/routes.mjs → prerender-manifest.ts) is prerendered, later ones render through the client fallback.
 * Cart, checkout, login, thanks, search, account, admin and 404 are client-rendered.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'courses', renderMode: RenderMode.Prerender },
  { path: 'books', renderMode: RenderMode.Prerender },
  {
    path: 'p/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      return PRODUCT_SLUGS.map((slug) => ({ slug }));
    },
  },
  { path: '**', renderMode: RenderMode.Client },
];
