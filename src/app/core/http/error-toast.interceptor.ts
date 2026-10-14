import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { STORE_API_URL, isStoreApiUrl } from '../api/store-api-url';
import { ToastService } from '../ui/toast.service';

/** Background requests (the cart badge) whose failure the visitor shouldn't hear about. */
export const SILENT = new HttpContextToken<boolean>(() => false);

/** 5xx and network failures from the store API → one generic toast. Never shows a raw error body. 4xx are the screens' job. */
export const errorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(STORE_API_URL);
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        isStoreApiUrl(req.url, api) &&
        !req.context.get(SILENT) &&
        error instanceof HttpErrorResponse &&
        (error.status >= 500 || error.status === 0)
      ) {
        toast.show(
          $localize`:@@store.error.toast-server:تعذّر الاتصال بالمتجر الآن. حاول مرة أخرى بعد قليل.`,
          'error',
        );
      }
      return throwError(() => error);
    }),
  );
};
