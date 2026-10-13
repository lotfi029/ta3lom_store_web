import { RenderMode, ServerRoute } from '@angular/ssr';

/** Plan §2.2: public pages are prerendered; cart, checkout, account and admin are client-rendered. */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Prerender }];
