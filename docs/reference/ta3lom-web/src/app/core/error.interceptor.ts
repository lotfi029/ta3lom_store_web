import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { isAdminPath } from './admin-path';
import { I18nService } from './i18n';
import { ToastService } from './toast.service';

/**
 * Maps 404 to the not-found route, 5xx to a toast. Never surfaces a raw error body.
 *
 * Session 2, Part 1: the 404-redirect is skipped for /admin requests. A CRUD dashboard hits 404
 * on purpose — GET /admin/posts/:id for a since-deleted row, a delete-then-refresh race — and
 * navigating the whole app to /not-found on any of those would eject the editor out of the
 * screen they were working in. Admin data services and components handle their own 404s (a
 * missing row, an already-deleted item) locally instead. Same detection as auth.interceptor.ts.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const i18n = inject(I18nService);
  const isAdminRequest = isAdminPath(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 404 && !isAdminRequest) {
          void router.navigateByUrl('/not-found');
        } else if (error.status >= 500) {
          toast.show(i18n.pick('حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.', 'Something went wrong. Please try again.'));
        }
      }
      return throwError(() => error);
    }),
  );
};
