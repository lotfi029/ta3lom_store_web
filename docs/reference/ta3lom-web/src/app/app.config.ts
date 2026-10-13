import {
  ApplicationConfig,
  DOCUMENT,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withNoHttpTransferCache } from '@angular/platform-browser';
import { authInterceptor } from './core/auth.interceptor';
import { errorInterceptor } from './core/error.interceptor';
import { prerenderHttpCacheInterceptor } from './core/prerender-http-cache';
import { I18nService } from './core/i18n';
import { resolveDevLocalePrefix } from './core/dev-locale-prefix';
import { installForeignErrorFilter } from './core/foreign-error-filter';
import { ToastService } from './core/toast.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Without this, Angular serializes every build-time httpResource() response into an
    // ng-state script and the hydrated client reuses it instead of refetching — silently
    // contradicting docs/architecture/02-routing-and-rendering.md's "the hydrated app then
    // refetches" guarantee. See e2e/transfer-cache.spec.ts for the regression test.
    provideClientHydration(withNoHttpTransferCache()),
    // errorInterceptor first so it sees the response last (Angular unwinds interceptors
    // in reverse order), after authInterceptor has already had its one 401-retry attempt.
    // prerenderHttpCacheInterceptor last, next to the network: a pass-through in the browser,
    // it only does anything at build time (see app.config.server.ts).
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, prerenderHttpCacheInterceptor])),
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      const locale = inject(LOCALE_ID);
      const i18n = inject(I18nService);
      const toast = inject(ToastService);
      document.documentElement.lang = locale;
      document.documentElement.dir = i18n.direction;
      installForeignErrorFilter();
      // Returned so bootstrap waits on it: without that, the wrong language paints for a moment
      // before the hand-off redirects. It only returns a promise on a URL carrying the other
      // locale's prefix — in production, and on every ordinary page load, it returns undefined.
      return resolveDevLocalePrefix(i18n.locale, (requested) => {
        const port = requested === 'en' ? 4201 : 4200;
        const language = requested === 'en' ? 'English' : 'Arabic';
        toast.show(`The ${language} dev server (port ${port}) isn't running. Start both with: npm run dev`);
      });
    }),
  ],
};
