import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, filter, map, shareReplay, tap } from 'rxjs';

/**
 * Build-time only: every GET is fetched once per prerender worker, and every later route that asks
 * for the same URL is answered from memory.
 *
 * Why: the header, the footer and the about pages load the same datasets on every route, so a
 * build used to send ~990 requests to api.ta3lom.sa in ~4 seconds (API runtime log, 2026-09-30
 * 04:36:28–31, ~300/s) for ~150 pages — from the one IP of Hostinger's build server. The host's
 * burst protection then blocks that IP for up to ~30 minutes, and the NEXT build to start inside
 * that window fails in scripts/routes.mjs with `HTTP 403` before it renders anything (every failed
 * build since 2026-09-29 started within minutes of a successful one). Fewer requests, no block.
 *
 * Scope: app.config.server.ts calls this once at module load, and with `"ssr": false` in
 * angular.json `ng serve` never renders on the server — so the server config runs solely inside the
 * build's prerender workers, and one cache lives exactly as long as one worker: one build. Each
 * worker renders its routes one after another, and each locale has its own workers, so a URL every
 * page needs is fetched at most (workers x locales) times instead of once per page.
 *
 * Only the network is shared across routes, never an object: each hit gets a deep copy of the body,
 * so a component that sorts or edits the list it was given cannot leak that into another page.
 * A failed request is dropped from the cache, so the next route asks the API again instead of
 * inheriting the error.
 */
export function createPrerenderHttpCache(): HttpInterceptorFn {
  const cache = new Map<string, Observable<HttpResponse<unknown>>>();

  return (req, next) => {
    if (req.method !== 'GET') return next(req);

    const key = req.urlWithParams;
    let response = cache.get(key);
    if (!response) {
      response = next(req).pipe(
        filter((event: HttpEvent<unknown>): event is HttpResponse<unknown> => event instanceof HttpResponse),
        tap({ error: () => cache.delete(key) }),
        shareReplay(1),
      );
      cache.set(key, response);
    }

    return response.pipe(map((res) => res.clone({ body: structuredClone(res.body) })));
  };
}
