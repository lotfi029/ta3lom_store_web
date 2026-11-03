import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, throwError, timer, switchMap } from 'rxjs';
import { STORE_API_URL, isStoreApiUrl } from '../api/store-api-url';

/** Transient failures worth one more try: network (0), 502, 503, 504. Never 429 or any other 4xx/5xx. */
export const RETRYABLE = new Set([0, 502, 503, 504]);

/** 300–800 ms, so many tabs that failed together don't come back together. */
export const retryDelay = (random: () => number = Math.random): number =>
  300 + Math.floor(random() * 501);

/**
 * One retry for idempotent reads (owner M-7): store-API GETs only, once, on a network error or 502/503/504, after a
 * 300–800 ms jitter. Never for writes, never on 429/4xx, never during the build's prerender (server), never for
 * `/auth/refresh` (the refresh single-flight decides about sessions itself).
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(STORE_API_URL);
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const eligible =
    browser &&
    req.method === 'GET' &&
    isStoreApiUrl(req.url, api) &&
    !/\/auth\/refresh(?:$|\?)/.test(req.url) &&
    !/\/admin\/auth\/refresh(?:$|\?)/.test(req.url);
  if (!eligible) return next(req);
  return next(req).pipe(
    catchError((error: unknown) =>
      error instanceof HttpErrorResponse && RETRYABLE.has(error.status)
        ? timer(retryDelay()).pipe(switchMap(() => next(req)))
        : throwError(() => error),
    ),
  );
};
