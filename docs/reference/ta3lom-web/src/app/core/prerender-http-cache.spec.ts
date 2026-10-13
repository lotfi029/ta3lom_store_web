import { HttpErrorResponse, HttpEvent, HttpEventType, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { PRERENDER_HTTP_CACHE, prerenderHttpCacheInterceptor } from './prerender-http-cache';
import { createPrerenderHttpCache } from './prerender-http-cache.server';

/**
 * The build used to send ~990 API requests in ~4 seconds, and the host's burst protection blocked
 * the build server for the next build. The cache collapses repeats of the same GET within one
 * prerender worker — and the interceptor must be a strict pass-through wherever the server config
 * is absent.
 */
function respond(body: unknown) {
  const sent: HttpEvent<unknown> = { type: HttpEventType.Sent };
  return vi.fn((): Observable<HttpEvent<unknown>> => of(sent, new HttpResponse({ status: 200, body })));
}

describe('prerenderHttpCacheInterceptor', () => {
  function run(req: HttpRequest<unknown>, next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>) {
    return TestBed.runInInjectionContext(() => firstValueFrom(prerenderHttpCacheInterceptor(req, next)));
  }

  it('passes every request through when no cache is provided (the browser)', async () => {
    const next = respond({ items: [] });
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/settings');

    await run(req, next);
    await run(req, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('hands the request to the cache the server config provides', async () => {
    const cache = vi.fn<HttpInterceptorFn>((req, next) => next(req));
    TestBed.configureTestingModule({ providers: [{ provide: PRERENDER_HTTP_CACHE, useValue: cache }] });
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/settings');

    await run(req, respond({}));

    expect(cache).toHaveBeenCalledWith(req, expect.any(Function));
  });
});

describe('createPrerenderHttpCache', () => {
  function run(
    cache: HttpInterceptorFn,
    req: HttpRequest<unknown>,
    next: (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>,
  ) {
    return firstValueFrom(cache(req, next)) as Promise<HttpResponse<unknown>>;
  }

  it('fetches a repeated GET once and answers the rest from memory', async () => {
    const cache = createPrerenderHttpCache();
    const next = respond({ phone: '0100' });
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/settings');

    const first = await run(cache, req, next);
    const second = await run(cache, req, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(first).toBeInstanceOf(HttpResponse);
    expect(second.body).toEqual({ phone: '0100' });
  });

  it('keys on the query string, so different params are different requests', async () => {
    const cache = createPrerenderHttpCache();
    const next = respond({ items: [] });

    await run(cache, new HttpRequest('GET', 'https://api.ta3lom.sa/documents?section=reports'), next);
    await run(cache, new HttpRequest('GET', 'https://api.ta3lom.sa/documents?section=assembly'), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('hands each caller its own copy of the body', async () => {
    const cache = createPrerenderHttpCache();
    const next = respond({ items: [3, 1, 2] });
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/programs');

    const first = (await run(cache, req, next)) as HttpResponse<{ items: number[] }>;
    first.body?.items.sort();
    const second = (await run(cache, req, next)) as HttpResponse<{ items: number[] }>;

    expect(second.body?.items).toEqual([3, 1, 2]);
  });

  it('forgets a failed request, so the next route asks the API again', async () => {
    const cache = createPrerenderHttpCache();
    const failing = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/stats');

    await expect(run(cache, req, failing)).rejects.toBeInstanceOf(HttpErrorResponse);
    const next = respond({ members: 10 });
    const retried = await run(cache, req, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(retried.body).toEqual({ members: 10 });
  });

  it('never caches a non-GET request', async () => {
    const cache = createPrerenderHttpCache();
    const next = respond({ ok: true });
    const req = new HttpRequest('POST', 'https://api.ta3lom.sa/submissions/contact', {});

    await run(cache, req, next);
    await run(cache, req, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('keeps separate caches apart — one per prerender worker', async () => {
    const next = respond({});
    const req = new HttpRequest('GET', 'https://api.ta3lom.sa/settings');

    await run(createPrerenderHttpCache(), req, next);
    await run(createPrerenderHttpCache(), req, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
