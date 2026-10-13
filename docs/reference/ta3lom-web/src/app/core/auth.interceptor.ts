import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { isAdminPath } from './admin-path';
import { AuthService } from './auth.service';

/** Marks a request as already-retried, so a second 401 propagates instead of looping. */
const ALREADY_RETRIED = new HttpContextToken<boolean>(() => false);

/** Attaches the Bearer token to /admin requests only, and retries once on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAdminRequest = isAdminPath(req.url);
  const token = auth.accessToken();

  const authedReq = isAdminRequest && token ? withBearer(req, token) : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const shouldRetry =
        isAdminRequest && error instanceof HttpErrorResponse && error.status === 401 && !req.context.get(ALREADY_RETRIED);

      if (!shouldRetry) {
        return throwError(() => error);
      }

      return from(auth.refresh()).pipe(
        switchMap((newToken) => {
          const retried = withBearer(req, newToken).clone({ context: req.context.set(ALREADY_RETRIED, true) });
          return next(retried);
        }),
        catchError((refreshError: unknown) => {
          // clearSession() alone left the editor sitting on a dashboard with no valid token,
          // every further request 401ing, until they happened to trigger a navigation the route
          // guard would catch (M8, admin-dashboard-code-review.md). Send them to login directly
          // instead of waiting for that.
          auth.clearSession();
          void router.navigateByUrl('/admin/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
