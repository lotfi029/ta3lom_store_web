import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the store API, e.g. `https://store-api.ta3lom.sa/v1` (plan §2.3). No trailing slash. */
export const STORE_API_URL = new InjectionToken<string>('STORE_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl.replace(/\/$/, ''),
});

/** True when `url` targets the store API (origin + `/v1` path) — the only requests that get credentials or a bearer. */
export function isStoreApiUrl(url: string, apiUrl: string): boolean {
  return url === apiUrl || url.startsWith(`${apiUrl}/`) || url.startsWith(`${apiUrl}?`);
}
