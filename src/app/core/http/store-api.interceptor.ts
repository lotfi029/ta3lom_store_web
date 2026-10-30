import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { sessionRejected } from '../auth/session-rejected';
import { StaffAuth } from '../auth/staff-auth';
import { StoreAuth } from '../auth/store-auth';
import { I18nService } from '../i18n/i18n';
import { STORE_API_URL, isStoreApiUrl } from '../api/store-api-url';

const RETRIED = new HttpContextToken<boolean>(() => false);
/** Set on a request that must not trigger a session refresh (e.g. the thanks page polling with a status token). */
export const NO_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * Credentials and bearer for the STORE API ORIGIN ONLY (non-negotiable #9, plan §2.4). Any other URL passes untouched.
 *   - `withCredentials` (cart cookie, refresh cookies) and `Accept-Language` on every store API call;
 *   - bearer: the staff token for `/admin/**`, the customer token otherwise;
 *   - 401 → one single-flight refresh → one retry. A refused staff refresh sends the user to /admin/login.
 *   - 403 `auth.password_change_required` on a staff request → /admin/password (backstop of the `pwd_change` claim
 *     check in the guards, C-6).
 */
export const storeApiInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(STORE_API_URL);
  if (!isStoreApiUrl(req.url, api)) return next(req);

  const i18n = inject(I18nService);
  const staffRequest = req.url.startsWith(`${api}/admin/`) || req.url === `${api}/admin`;
  const auth: StoreAuth | StaffAuth = staffRequest ? inject(StaffAuth) : inject(StoreAuth);
  const router = inject(Router);

  const prepare = (r: HttpRequest<unknown>, token: string | null) =>
    r.clone({
      withCredentials: true,
      setHeaders: {
        'Accept-Language': i18n.locale,
        ...(token && !r.headers.has('Authorization') ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  return next(prepare(req, auth.accessToken())).pipe(
    catchError((error: unknown) => {
      if (
        staffRequest &&
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        (error.error as { code?: unknown } | null)?.code === 'auth.password_change_required'
      ) {
        void router.navigateByUrl('/admin/password');
        return throwError(() => error);
      }
      const refreshable =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.context.get(RETRIED) &&
        !req.context.get(NO_REFRESH) &&
        !/\/(admin\/)?auth\//.test(req.url);
      if (!refreshable) return throwError(() => error);
      return from(auth.refresh()).pipe(
        switchMap((token) =>
          next(
            prepare(
              req.clone({
                context: req.context.set(RETRIED, true),
                headers: req.headers.delete('Authorization'),
              }),
              token,
            ),
          ),
        ),
        catchError((refreshError: unknown) => {
          // A transient refresh failure (network, 5xx, 429) keeps the staff member on the screen.
          if (staffRequest && sessionRejected(refreshError))
            void router.navigate(['/admin/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => error);
        }),
      );
    }),
  );
};
