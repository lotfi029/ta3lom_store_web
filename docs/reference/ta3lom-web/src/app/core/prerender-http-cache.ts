import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';

/**
 * Provided ONLY by app.config.server.ts, with the build-time response cache from
 * prerender-http-cache.server.ts. It is a token rather than an entry in withInterceptors() so the
 * cache — and the rxjs operators it needs — never reach the browser bundle, where it would be dead
 * code: the browser gets only the three-line delegator below.
 */
export const PRERENDER_HTTP_CACHE = new InjectionToken<HttpInterceptorFn>('PRERENDER_HTTP_CACHE');

/** A pass-through in the browser; at build time, hands the request to the prerender cache. */
export const prerenderHttpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(PRERENDER_HTTP_CACHE, { optional: true });
  return cache ? cache(req, next) : next(req);
};
