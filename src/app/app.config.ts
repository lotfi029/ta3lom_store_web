import {
  ApplicationConfig,
  DOCUMENT,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withNoHttpTransferCache } from '@angular/platform-browser';
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
    // Prerendered public pages refetch after hydration (refresh-after-hydration); no build-time snapshot is replayed.
    provideClientHydration(withNoHttpTransferCache()),
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
