import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AccessTokenResponse,
  CartNotice,
  CustomerSession,
  OtpRequestedResponse,
  SessionResponse,
} from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { I18nService } from '../i18n/i18n';

/**
 * Customer session (ADR-S04, 11 §4). The access token lives in a signal only — never in storage (non-negotiable #9).
 * The refresh token is the API's HttpOnly `t3s_rt` cookie; `refresh()` is single-flight, so N parallel 401s cause one
 * refresh. Auth calls go through HttpBackend (no interceptors) with credentials, so they can't loop through the
 * refresh-on-401 logic.
 */
@Injectable({ providedIn: 'root' })
export class StoreAuth {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly api = inject(STORE_API_URL);
  private readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly token = signal<string | null>(null);
  readonly accessToken = this.token.asReadonly();
  readonly customer = signal<CustomerSession | null>(null);
  readonly isSignedIn = computed(() => this.token() !== null);
  /** Notices from the guest-cart merge on the last sign-in (RUL-17) — the cart shows and clears them. */
  readonly cartNotices = signal<CartNotice[]>([]);

  private refreshing: Promise<string> | null = null;
  private restoring: Promise<boolean> | null = null;

  private readonly options = () => ({
    withCredentials: true,
    headers: { 'Accept-Language': this.i18n.locale },
  });

  requestOtp(mobile: string): Promise<OtpRequestedResponse> {
    return firstValueFrom(
      this.http.post<OtpRequestedResponse>(
        `${this.api}/auth/otp/request`,
        { mobile, locale: this.i18n.locale },
        this.options(),
      ),
    );
  }

  async verifyOtp(mobile: string, code: string): Promise<SessionResponse> {
    const session = await firstValueFrom(
      this.http.post<SessionResponse>(
        `${this.api}/auth/otp/verify`,
        { mobile, code },
        this.options(),
      ),
    );
    this.token.set(session.accessToken);
    this.customer.set(session.customer);
    this.cartNotices.set(session.cartNotices ?? []);
    this.restoring = Promise.resolve(true);
    return session;
  }

  /** Single-flight refresh via the `t3s_rt` cookie. Resolves the new token; rejects (and clears) when the session is gone. */
  refresh(): Promise<string> {
    if (!this.browser) return Promise.reject(new Error('no session during prerender'));
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async doRefresh(retried = false): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<AccessTokenResponse>(`${this.api}/auth/refresh`, null, this.options()),
      );
      this.token.set(res.accessToken);
      return res.accessToken;
    } catch (err) {
      // auth.refresh_race (409): a parallel tab refreshed within 20 s — retry once (11 §1.6).
      if (!retried && (err as { status?: number }).status === 409) return this.doRefresh(true);
      this.clear();
      throw err;
    }
  }

  /** Restores a session after a page load (one refresh attempt per page view). Guards and the header call this. */
  ensureSession(): Promise<boolean> {
    if (this.token()) return Promise.resolve(true);
    if (!this.browser) return Promise.resolve(false);
    this.restoring ??= this.refresh().then(
      () => true,
      () => false,
    );
    return this.restoring;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.api}/auth/logout`, null, this.options()));
    } finally {
      this.clear();
    }
  }

  /** #20: revokes every session of this customer (needs the bearer). */
  async logoutAll(): Promise<void> {
    const token = this.token();
    try {
      await firstValueFrom(
        this.http.post(`${this.api}/auth/logout-all`, null, {
          withCredentials: true,
          headers: {
            'Accept-Language': this.i18n.locale,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
      );
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.token.set(null);
    this.customer.set(null);
    this.restoring = Promise.resolve(false);
  }
}
