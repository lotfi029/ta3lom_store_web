import {
  ApplicationConfig,
  DOCUMENT,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { errorToastInterceptor } from './core/http/error-toast.interceptor';
import { prerenderHttpCacheInterceptor } from './core/http/prerender-http-cache';
import { storeApiInterceptor } from './core/http/store-api.interceptor';
import { I18nService } from './core/i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // The build-time responses embedded in each prerendered page are replayed during hydration, so the page keeps its
    // content (no blank-and-refill layout shift); every public page then reloads its data once (refresh-after-hydration).
    // `includeRequestsWithCredentials`: the store-API interceptor marks every API call `withCredentials` (refresh cookie),
    // which would otherwise exclude the public catalogue reads from the transfer cache. Only GETs are cached, and the
    // build has no session, so nothing personal can land in a prerendered page.
    provideClientHydration(withHttpTransferCacheOptions({ includeRequestsWithCredentials: true })),
    // errorToast first (sees the final outcome), the store-API interceptor next (credentials, bearer, refresh),
    // the prerender cache last (a pass-through in the browser).
    provideHttpClient(
      withFetch(),
      withInterceptors([errorToastInterceptor, storeApiInterceptor, prerenderHttpCacheInterceptor]),
    ),
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      const i18n = inject(I18nService);
      document.documentElement.lang = i18n.locale;
      document.documentElement.dir = i18n.direction;
    }),
  ],
};
