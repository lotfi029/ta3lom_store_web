import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { errorInterceptor } from './error.interceptor';
import { ToastService } from './toast.service';

/**
 * Session 2, Part 1: a 404 from an /admin request must NOT navigate the app to /not-found — a
 * CRUD dashboard hits 404 on purpose (a since-deleted row, a delete-then-refresh race), and
 * ejecting the editor out of the screen they were working in would be wrong. A public-route 404
 * still redirects, unchanged from before.
 */
describe('errorInterceptor', () => {
  function setup() {
    const navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigateByUrl } }],
    });
    return { navigateByUrl };
  }

  it('navigates to /not-found on a 404 from a public request', async () => {
    const { navigateByUrl } = setup();
    const req = new HttpRequest('GET', '/programs/unknown-slug');
    const next = () => throwError(() => new HttpErrorResponse({ status: 404 }));

    await TestBed.runInInjectionContext(
      () => new Promise<void>((resolve) => {
        errorInterceptor(req, next).subscribe({ error: () => resolve() });
      }),
    );

    expect(navigateByUrl).toHaveBeenCalledWith('/not-found');
  });

  it('does NOT navigate to /not-found on a 404 from an /admin request', async () => {
    const { navigateByUrl } = setup();
    const req = new HttpRequest('GET', '/admin/posts/deleted-id');
    const next = () => throwError(() => new HttpErrorResponse({ status: 404 }));

    await TestBed.runInInjectionContext(
      () => new Promise<void>((resolve) => {
        errorInterceptor(req, next).subscribe({ error: () => resolve() });
      }),
    );

    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows a toast on a 5xx from an admin request too', async () => {
    setup();
    const toast = TestBed.inject(ToastService);
    const req = new HttpRequest('GET', '/admin/programs');
    const next = () => throwError(() => new HttpErrorResponse({ status: 500 }));

    await TestBed.runInInjectionContext(
      () => new Promise<void>((resolve) => {
        errorInterceptor(req, next).subscribe({ error: () => resolve() });
      }),
    );

    expect(toast.current()).not.toBeNull();
  });

  it('passes a successful response through unchanged', async () => {
    setup();
    const req = new HttpRequest('GET', '/admin/programs');
    const next = () => of(new HttpResponse({ status: 200 }));

    const result = await TestBed.runInInjectionContext(
      () => new Promise<HttpResponse<unknown>>((resolve) => {
        errorInterceptor(req, next).subscribe((event) => resolve(event as HttpResponse<unknown>));
      }),
    );

    expect(result.status).toBe(200);
  });
});
