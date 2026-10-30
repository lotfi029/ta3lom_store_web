import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AccessTokenResponse,
  CartNotice,
  Me,
  OtpRequestedResponse,
  SessionResponse,
} from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { I18nService } from '../i18n/i18n';
import { sessionRejected } from './session-rejected';

/** What the header, account menu and checkout show about the signed-in donor (from the session or `GET /v1/me`). */
export type DonorProfile = Pick<Me, 'id' | 'mobile' | 'fullName' | 'email' | 'locale'>;

/**
 * Donor session (ADR-S04, contract 15 §2.2). The access token lives in a signal only — never in storage (non-negotiable #9).
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
  readonly customer = signal<DonorProfile | null>(null);
  readonly isSignedIn = computed(() => this.token() !== null);
  /** Notices from the guest-cart merge on the last sign-in (RUL-17) — the cart shows and clears them. */
  readonly cartNotices = signal<CartNotice[]>([]);

  private refreshing: Promise<string> | null = null;
  private restoring: Promise<boolean> | null = null;
  private loadingMe: Promise<void> | null = null;

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
    const c = session.customer;
    this.customer.set({
      id: c.id,
      mobile: c.mobile,
      fullName: c.fullName,
      email: c.email,
      locale: c.locale,
    });
    this.cartNotices.set(session.cartNotices ?? []);
    this.restoring = Promise.resolve(true);
    return session;
  }

  /**
   * Single-flight refresh via the `t3s_rt` cookie. Resolves the new token; rejects — and clears only when the API refused
   * the session (`sessionRejected`). A network error, 5xx or 429 rejects without clearing: the cookie may still be good.
   */
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
      // W-2: a restored session has a token but no profile yet — load /v1/me once (the menu shows name + mobile).
      if (!this.customer()) await this.loadMe();
      return res.accessToken;
    } catch (err) {
      // auth.refresh_race (409): a parallel tab refreshed within 20 s — retry once (11 §1.6).
      if (!retried && (err as { status?: number }).status === 409) return this.doRefresh(true);
      if (sessionRejected(err)) this.clear();
      throw err;
    }
  }

  /**
   * Restores a session after a page load. Guards and the header call this. A refused session is remembered for the page
   * view (one refresh attempt); after a transient failure the next call tries again.
   */
  ensureSession(): Promise<boolean> {
    if (this.token()) return Promise.resolve(true);
    if (!this.browser) return Promise.resolve(false);
    this.restoring ??= this.refresh().then(
      () => true,
      (err: unknown) => {
        if (!sessionRejected(err)) this.restoring = null;
        return false;
      },
    );
    return this.restoring;
  }

  /** `GET /v1/me` → the donor profile (single-flight). A failure leaves the session signed in without a profile. */
  loadMe(): Promise<void> {
    const token = this.token();
    if (!token) return Promise.resolve();
    this.loadingMe ??= firstValueFrom(
      this.http.get<Me>(`${this.api}/me`, {
        withCredentials: true,
        headers: { 'Accept-Language': this.i18n.locale, Authorization: `Bearer ${token}` },
      }),
    )
      .then((me) => this.setProfile(me))
      .catch(() => undefined)
      .finally(() => (this.loadingMe = null));
    return this.loadingMe;
  }

  /** After `PATCH /v1/me` (profile page, checkout contact): the menu and checkout show the new values. */
  setProfile(me: Pick<Me, 'id' | 'mobile' | 'fullName' | 'email' | 'locale'>): void {
    this.customer.set({
      id: me.id,
      mobile: me.mobile,
      fullName: me.fullName,
      email: me.email,
      locale: me.locale,
    });
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.api}/auth/logout`, null, this.options()));
    } finally {
      this.clear();
    }
  }

  /**
   * Revokes every session of this customer. `logout-all` needs a valid bearer and the access token may be minutes old, so
   * a 401 refreshes once and sends it again. If it still fails nothing was revoked and the API kept `t3s_rt`: `logout()`
   * at least ends this device's session (clears the cookie), and the error reaches the caller, which tells the donor.
   */
  async logoutAll(): Promise<void> {
    try {
      try {
        await this.postLogoutAll(this.token());
      } catch (err) {
        if ((err as { status?: number }).status !== 401) throw err;
        await this.postLogoutAll(await this.refresh());
      }
    } catch (err) {
      await this.logout().catch(() => undefined);
      throw err;
    } finally {
      this.clear();
    }
  }

  private postLogoutAll(token: string | null): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.api}/auth/logout-all`, null, {
        withCredentials: true,
        headers: {
          'Accept-Language': this.i18n.locale,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }),
    );
  }

  clear(): void {
    this.token.set(null);
    this.customer.set(null);
    this.cartNotices.set([]);
    this.restoring = Promise.resolve(false);
  }
}
