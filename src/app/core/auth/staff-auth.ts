import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  StaffLoginResponse,
  StaffMe,
  StaffSessionResponse,
  TotpSetupResponse,
} from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { I18nService } from '../i18n/i18n';
import { type StaffPolicy, rolesAllow } from './policies';
import { sessionRejected } from './session-rejected';

/**
 * Reads the claims of a JWT access token (base64url JSON payload) without verifying it — the API verifies; the web only
 * needs to know what the token says. Returns {} for anything that is not a JWT.
 */
export function tokenClaims(token: string | null): Record<string, unknown> {
  const part = token?.split('.')[1];
  if (!part) return {};
  try {
    const b64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** C-6 / E-3: a pending forced password change, read from the token's `pwd_change` claim (`"true"`). */
export const pendingPasswordChange = (token: string | null): boolean => {
  const v = tokenClaims(token)['pwd_change'];
  return v === 'true' || v === true;
};

/**
 * Staff session (contract 15 §1.6, §2.6): email + password → short-lived MFA token → TOTP set-up (first time) or code →
 * access token (signal only) + `t3s_srt` refresh cookie (Path=/v1/admin/auth).
 *
 * Forced password change: the `pwd_change` claim of EVERY token received (code, refresh, password change) is the source
 * of truth (`mustChangePassword`); `StaffSessionResponse.staff.mustChangePassword` is only a cross-check (either one
 * true → pending). While pending, every `staff:*` route answers 403 `auth.password_change_required` — the guards send
 * the user to /admin/password, and the interceptor does the same as a backstop. `GET /admin/me` is 403 too, so the
 * profile comes from the session response instead.
 */
@Injectable({ providedIn: 'root' })
export class StaffAuth {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly api = inject(STORE_API_URL);
  private readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly token = signal<string | null>(null);
  private mfaToken: string | null = null;
  readonly accessToken = this.token.asReadonly();
  readonly staff = signal<StaffMe | null>(null);
  readonly isSignedIn = computed(() => this.token() !== null);
  readonly roles = computed(() => this.staff()?.roles ?? []);
  private readonly sessionSaysChange = signal(false);
  readonly mustChangePassword = computed(
    () => this.isSignedIn() && (pendingPasswordChange(this.token()) || this.sessionSaysChange()),
  );

  private refreshing: Promise<string> | null = null;
  private restoring: Promise<boolean> | null = null;

  private headers(bearer?: string | null) {
    return {
      withCredentials: true,
      headers: {
        'Accept-Language': this.i18n.locale,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    };
  }

  /** A policy the signed-in member holds — never while a password change is pending (every `staff:*` is 403 then). */
  can(policy: StaffPolicy): boolean {
    return !this.mustChangePassword() && rolesAllow(this.roles(), policy);
  }

  /** Step 1: password. Resolves whether TOTP is already set up (code) or must be set up first. */
  async login(email: string, password: string): Promise<StaffLoginResponse> {
    const res = await firstValueFrom(
      this.http.post<StaffLoginResponse>(
        `${this.api}/admin/auth/login`,
        { email, password },
        this.headers(),
      ),
    );
    this.mfaToken = res.mfaToken;
    return res;
  }

  /** Step 2a (first sign-in or after a reset): the secret and otpauth URI for the authenticator app. */
  setupTotp(): Promise<TotpSetupResponse> {
    return firstValueFrom(
      this.http.post<TotpSetupResponse>(
        `${this.api}/admin/auth/totp/enrol`,
        null,
        this.headers(this.mfaToken),
      ),
    );
  }

  /** Step 2b: the 6-digit code → session. */
  async verify(code: string): Promise<StaffSessionResponse> {
    const session = await firstValueFrom(
      this.http.post<StaffSessionResponse>(
        `${this.api}/admin/auth/totp/verify`,
        { code },
        this.headers(this.mfaToken),
      ),
    );
    this.mfaToken = null;
    this.setSession(session);
    return session;
  }

  /**
   * `POST /admin/auth/password` (forced or self-service). Success revokes every other session of the member and returns
   * a fresh one (new `t3s_srt` cookie, token without `pwd_change`) — it replaces the current one at once.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<StaffSessionResponse> {
    const session = await firstValueFrom(
      this.http.post<StaffSessionResponse>(
        `${this.api}/admin/auth/password`,
        { currentPassword, newPassword },
        this.headers(this.token()),
      ),
    );
    this.setSession(session);
    return session;
  }

  refresh(): Promise<string> {
    if (!this.browser) return Promise.reject(new Error('no session during prerender'));
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async doRefresh(retried = false): Promise<string> {
    try {
      const s = await firstValueFrom(
        this.http.post<StaffSessionResponse>(
          `${this.api}/admin/auth/refresh`,
          null,
          this.headers(),
        ),
      );
      this.setSession(s);
      return s.accessToken;
    } catch (err) {
      // auth.refresh_race (409): a parallel tab rotated the cookie within 20 s — the cookie is kept, retry once.
      if (!retried && (err as { status?: number }).status === 409) return this.doRefresh(true);
      // Only a refused session ends it; a network error, 5xx or 429 leaves the cookie as it was (sessionRejected).
      if (sessionRejected(err)) this.clear();
      throw err;
    }
  }

  /** A refused session is remembered for the page view; after a transient failure the next guard tries again. */
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

  /** The current staff profile and roles (a role change by an admin applies without signing in again). */
  async refreshMe(): Promise<StaffMe | null> {
    const token = this.token();
    if (!token || this.mustChangePassword()) return null;
    try {
      const me = await firstValueFrom(
        this.http.get<StaffMe>(`${this.api}/admin/me`, this.headers(token)),
      );
      this.staff.set(me);
      return me;
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.api}/admin/auth/logout`, null, this.headers()));
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.token.set(null);
    this.staff.set(null);
    this.sessionSaysChange.set(false);
    this.restoring = Promise.resolve(false);
  }

  private setSession(s: StaffSessionResponse): void {
    this.token.set(s.accessToken);
    this.staff.set(s.staff);
    this.sessionSaysChange.set(!!s.staff?.mustChangePassword);
    this.restoring = Promise.resolve(true);
  }
}
