import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { PROJECT_SLUGS } from './prerender-manifest';

/**
 * D-W3: only the home/listing and the project pages are prerendered. Every published project slug known at build time
 * (scripts/routes.mjs → prerender-manifest.ts) gets a page; later ones render through the client fallback
 * (`index.csr.html`, E-1). Cart, checkout, order, account, login, admin and 404 are client-rendered.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  {
    path: 'p/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      return PROJECT_SLUGS.map((slug) => ({ slug }));
    },
  },
  { path: '**', renderMode: RenderMode.Client },
];
