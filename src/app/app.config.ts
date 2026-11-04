import {
  ApplicationConfig,
  DOCUMENT,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withI18nSupport,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { errorToastInterceptor } from './core/http/error-toast.interceptor';
import { prerenderHttpCacheInterceptor } from './core/http/prerender-http-cache';
import { retryInterceptor } from './core/http/retry.interceptor';
import { storeApiInterceptor } from './core/http/store-api.interceptor';
import { ReportingErrorHandler, errorReportInterceptor } from './core/monitoring/error-reporter';
import { I18nService } from './core/i18n/i18n';
import { provideNavigationScroll } from './core/routing/navigation-scroll';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Restoration is done by NavigationScroll (review 06 F-1): query-only listing changes do not jump to the top.
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled', anchorScrolling: 'disabled' }),
    ),
    provideNavigationScroll(),
    // The build-time responses embedded in each prerendered page are replayed during hydration, so the page keeps its
    // content (no blank-and-refill layout shift); every public page then reloads its data once (refresh-after-hydration).
    // `includeRequestsWithCredentials`: the store-API interceptor marks every API call `withCredentials` (refresh cookie),
    // which would otherwise exclude the public catalogue reads from the transfer cache. Only GETs are cached, and the
    // build has no session, so nothing personal can land in a prerendered page.
    // F6.3: incremental hydration (implies event replay) for below-the-fold blocks: footer, trust row, pager.
    // withI18nSupport: without it every component holding an i18n block skipped hydration and was rebuilt in the
    // browser — the whole home page, its banner text repainting after the first long task (phone LCP ~3.8 s).
    provideClientHydration(
      withI18nSupport(),
      withIncrementalHydration(),
      withHttpTransferCacheOptions({ includeRequestsWithCredentials: true }),
    ),
    // errorToast and the error reporter first (they see the final outcome), the store-API interceptor next
    // (credentials, bearer, refresh), then one retry of idempotent reads on transient failures (M-7), the prerender
    // cache last (a pass-through in the browser).
    provideHttpClient(
      withFetch(),
      withInterceptors([
        errorToastInterceptor,
        errorReportInterceptor,
        storeApiInterceptor,
        retryInterceptor,
        prerenderHttpCacheInterceptor,
      ]),
    ),
    // P5: uncaught errors are reported (PII-free, off while environment.errorReportUrl is empty); no stack is shown.
    // provideBrowserGlobalErrorListeners() above routes the window's errors and rejections here: one path, one report (F-3).
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      const i18n = inject(I18nService);
      document.documentElement.lang = i18n.locale;
      document.documentElement.dir = i18n.direction;
    }),
  ],
};
