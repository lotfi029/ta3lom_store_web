import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ErrorHandler, Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORE_API_URL, isStoreApiUrl } from '../api/store-api-url';

/** Where reports go; '' (the default in every environment) turns the reporter off. Its origin is in the CSP (gen-csp). */
export const ERROR_REPORT_URL = new InjectionToken<string>('ERROR_REPORT_URL', {
  providedIn: 'root',
  factory: () => environment.errorReportUrl,
});

export interface ErrorReport {
  kind: 'error' | 'rejection' | 'api';
  /** The route with ids redacted, no query or hash. */
  route: string;
  /** Problem code (`cart.target_unavailable`), `http.<status>` or the error's name. */
  code: string;
  /** Short, scrubbed message — never a stack, a body, a token or personal data. */
  message: string;
  build: string;
  env: string;
  at: string;
}

export const MAX_REPORTS_PER_PAGE = 10;

/** Path only; order references, long numbers and tokens replaced. `/ar/orders/T3-26-000123?t=…` → `/ar/orders/:ref`. */
export function redactRoute(url: string): string {
  const path = url.split(/[?#]/)[0] || '/';
  return path
    .replace(/\/orders\/[^/]+/g, '/orders/:ref')
    .replace(/\/donations\/[^/]+/g, '/donations/:ref')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\d{5,}/g, '#');
}

/** No e-mails, phone-like or long numbers, bearer-like tokens; one line, 200 characters at most. */
export function scrub(text: string): string {
  return String(text)
    .replace(/\S+@\S+\.\S+/g, '[email]')
    .replace(/eyJ[A-Za-z0-9_-]*(\.[A-Za-z0-9_-]*){1,2}/g, '[token]')
    .replace(/[A-Za-z0-9_-]{24,}(\.[A-Za-z0-9_-]+){0,2}/g, '[token]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Client error reporter (owner brief P5, REVIEW): consent-free and PII-free — route (redacted), code, a scrubbed one-line
 * message, the build stamp; no stack, no request body, no user id, no cookies (`credentials: 'omit'`). Sources:
 * uncaught errors and unhandled rejections (window), Angular's ErrorHandler, and failed store-API calls (network/5xx).
 * At most 10 reports per page, each distinct one once. Off while ERROR_REPORT_URL is empty (the default). No third-party
 * script (CSP): a plain `fetch(..., { keepalive: true })`.
 */
@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly url = inject(ERROR_REPORT_URL);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly seen = new Set<string>();
  private sent = 0;
  private installed = false;

  get enabled(): boolean {
    return this.browser && !!this.url;
  }

  install(): void {
    if (!this.enabled || this.installed) return;
    this.installed = true;
    const w = this.document.defaultView;
    w?.addEventListener('error', (e: ErrorEvent) =>
      this.report('error', (e.error as Error | undefined)?.name ?? 'Error', e.message),
    );
    w?.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      this.report('rejection', r?.name ?? 'Rejection', r?.message ?? String(e.reason));
    });
  }

  report(kind: ErrorReport['kind'], code: string, message: string): void {
    if (!this.enabled || this.sent >= MAX_REPORTS_PER_PAGE) return;
    const route = redactRoute(this.document.location?.pathname ?? '/');
    const body: ErrorReport = {
      kind,
      route,
      code: scrub(code).slice(0, 80),
      message: scrub(message),
      build: this.build(),
      env: environment.envName,
      at: new Date().toISOString(),
    };
    const key = `${body.kind}|${body.route}|${body.code}|${body.message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.sent += 1;
    try {
      void fetch(this.url, {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => undefined);
    } catch {
      /* reporting must never break the page */
    }
  }

  private build(): string {
    return (
      this.document.querySelector('meta[name="build"]')?.getAttribute('content')?.split(' ')[1] ??
      'unknown'
    );
  }
}

/** Angular's ErrorHandler: keep the console output (dev tools), add a report. No stack ever reaches the visitor. */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  private readonly reporter = inject(ErrorReporter);

  override handleError(error: unknown): void {
    super.handleError(error);
    const e = error as { name?: string; message?: string } | null;
    this.reporter.report('error', e?.name ?? 'Error', e?.message ?? String(error));
  }
}

/** Failed store-API calls (network or 5xx) → a report with the problem code or `http.<status>` and the path template. */
export const errorReportInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(STORE_API_URL);
  const reporter = inject(ErrorReporter);
  if (!reporter.enabled || !isStoreApiUrl(req.url, api)) return next(req);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) {
        const code = (error.error as { code?: unknown } | null)?.code;
        reporter.report(
          'api',
          typeof code === 'string' ? code : `http.${error.status}`,
          `${req.method} ${redactRoute(req.url.slice(api.length) || '/')}`,
        );
      }
      return throwError(() => error);
    }),
  );
};
