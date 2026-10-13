import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

/**
 * docs/architecture/08-testing-and-budgets.md / Session 1's owed test: the 401 → refresh →
 * replay path, INCLUDING the case where refresh itself 401s — assert it does not loop. The
 * ALREADY_RETRIED HttpContextToken is the mechanism under test.
 */
describe('authInterceptor', () => {
  function setup(authServiceStub: Partial<AuthService>) {
    // M8, admin-dashboard-code-review.md: a failed refresh now navigates to /admin/login (see
    // below), so every test needs a Router double — a real Router with no routes configured
    // rejects navigateByUrl and leaves an unhandled rejection.
    const navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    return { navigateByUrl };
  }

  it('attaches the bearer token to /admin requests when one is present', async () => {
    setup({ accessToken: () => 'token-1' } as AuthService);
    const req = new HttpRequest('GET', '/admin/programs');
    const next = vi.fn((r: HttpRequest<unknown>) => {
      expect(r.headers.get('Authorization')).toBe('Bearer token-1');
      return of(new HttpResponse({ status: 200 }));
    });

    await TestBed.runInInjectionContext(() => new Promise<void>((resolve) => {
      authInterceptor(req, next).subscribe(() => resolve());
    }));

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not attach a bearer token to a non-admin request', async () => {
    setup({ accessToken: () => 'token-1' } as AuthService);
    const req = new HttpRequest('GET', '/programs');
    const next = vi.fn((r: HttpRequest<unknown>) => {
      expect(r.headers.has('Authorization')).toBe(false);
      return of(new HttpResponse({ status: 200 }));
    });

    await TestBed.runInInjectionContext(() => new Promise<void>((resolve) => {
      authInterceptor(req, next).subscribe(() => resolve());
    }));
  });

  it('on a 401 from an admin request, refreshes once and replays with the new token', async () => {
    let calls = 0;
    const refresh = vi.fn(() => Promise.resolve('fresh-token'));
    setup({ accessToken: () => 'stale-token', refresh } as unknown as AuthService);

    const req = new HttpRequest('GET', '/admin/programs');
    const next = vi.fn((r: HttpRequest<unknown>) => {
      calls += 1;
      if (calls === 1) {
        expect(r.headers.get('Authorization')).toBe('Bearer stale-token');
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }
      expect(r.headers.get('Authorization')).toBe('Bearer fresh-token');
      return of(new HttpResponse({ status: 200 }));
    });

    const result = await TestBed.runInInjectionContext(
      () => new Promise<HttpResponse<unknown>>((resolve, reject) => {
        authInterceptor(req, next).subscribe({ next: (event) => resolve(event as HttpResponse<unknown>), error: reject });
      }),
    );

    expect(calls).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  it('when refresh itself 401s, clears the session, navigates to login, retries exactly once and does not loop', async () => {
    let calls = 0;
    const clearSession = vi.fn();
    const refresh = vi.fn(() => Promise.reject(new HttpErrorResponse({ status: 401 })));
    const { navigateByUrl } = setup({ accessToken: () => 'stale-token', refresh, clearSession } as unknown as AuthService);

    const req = new HttpRequest('GET', '/admin/programs');
    const next = vi.fn(() => {
      calls += 1;
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    });

    const error = await TestBed.runInInjectionContext(
      () => new Promise<unknown>((resolve) => {
        authInterceptor(req, next).subscribe({ next: () => resolve(undefined), error: (err) => resolve(err) });
      }),
    );

    // next() is called exactly once — the interceptor never gets to retry the outer request
    // because refresh() itself rejects, so there is no second HTTP attempt and no loop.
    expect(calls).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    // M8: previously nothing redirected here — the editor was left on the dashboard with no
    // valid token, every further request 401ing, until they happened to trigger a navigation
    // the route guard would catch.
    expect(navigateByUrl).toHaveBeenCalledWith('/admin/login');
    expect(error).toBeInstanceOf(HttpErrorResponse);
  });

  it('a second 401 on the retried request propagates instead of retrying again', async () => {
    let calls = 0;
    const clearSession = vi.fn();
    const refresh = vi.fn(() => Promise.resolve('fresh-token'));
    setup({ accessToken: () => 'stale-token', refresh, clearSession } as unknown as AuthService);

    const req = new HttpRequest('GET', '/admin/programs');
    const next = vi.fn(() => {
      calls += 1;
      // Every attempt 401s, including the retried one.
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    });

    const error = await TestBed.runInInjectionContext(
      () => new Promise<unknown>((resolve) => {
        authInterceptor(req, next).subscribe({ next: () => resolve(undefined), error: (err) => resolve(err) });
      }),
    );

    // Exactly two attempts total: the original and the one retry, marked via the
    // ALREADY_RETRIED context token so a 401 on the retried request is not retried again.
    expect(calls).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(HttpErrorResponse);
  });
});
