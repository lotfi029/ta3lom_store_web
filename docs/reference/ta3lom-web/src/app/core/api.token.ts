import { InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

/**
 * Base URL of api.ta3lom.sa, swapped per build via angular.json's fileReplacements.
 *
 * In development the BROWSER half goes through `ng serve`'s `/api` proxy (proxy.conf.mjs), so its
 * requests are same-origin. The deployed API's CORS allow-list is exactly `https://ta3lom.sa` and
 * stays that way: it runs with `credentials: true`, so widening it to localhost would let any page
 * served from a dev machine ride an admin session. Without the proxy the page still paints — the
 * SSR pass fetches fine — but every interaction that refetches fails, which reads as "the site
 * works until you touch it": filter chips empty the list, forms cannot submit, admin login is
 * blocked with `Access-Control-Allow-Origin: 'https://ta3lom.sa'` in the console.
 *
 * The SSR half keeps the absolute URL. It runs in Node, where CORS does not apply and `fetch`
 * cannot resolve a relative path.
 *
 * `environment.production` is true in `environment.production.ts` AND `environment.ci.ts`, so this
 * branch is development-only and never reaches a built bundle.
 */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () =>
    !environment.production && isPlatformBrowser(inject(PLATFORM_ID)) ? '/api' : environment.apiUrl,
});
