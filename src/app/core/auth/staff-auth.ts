import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  StaffLoginResponse,
  StaffMe,
  StaffSessionResponse,
  TotpEnrolResponse,
} from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { I18nService } from '../i18n/i18n';
import { type StaffPolicy, rolesAllow } from './policies';

/**
 * Staff session (RUL-62, 11 §9.1): email + password → short-lived MFA token → TOTP enrol (first time) or verify →
 * access token (signal only) + `t3s_srt` refresh cookie (Path=/v1/admin/auth). `can(policy)` drives which admin actions
 * are enabled; the API enforces the same table.
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

  can(policy: StaffPolicy): boolean {
    return rolesAllow(this.roles(), policy);
  }

  /** Step 1: password. Resolves whether TOTP is already enrolled (verify) or must be set up (enrol). */
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

  /** Step 2a (first sign-in): the secret and otpauth URI for the authenticator app. */
  enrol(): Promise<TotpEnrolResponse> {
    return firstValueFrom(
      this.http.post<TotpEnrolResponse>(
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

  refresh(): Promise<string> {
    if (!this.browser) return Promise.reject(new Error('no session during prerender'));
    this.refreshing ??= firstValueFrom(
      this.http.post<StaffSessionResponse>(`${this.api}/admin/auth/refresh`, null, this.headers()),
    )
      .then((s) => {
        this.setSession(s);
        return s.accessToken;
      })
      .catch((err) => {
        this.clear();
        throw err;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  ensureSession(): Promise<boolean> {
    if (this.token()) return Promise.resolve(true);
    if (!this.browser) return Promise.resolve(false);
    this.restoring ??= this.refresh().then(
      () => true,
      () => false,
    );
    return this.restoring;
  }

  /** #52: the current staff profile and roles (a role change by an admin applies without signing in again). */
  async refreshMe(): Promise<StaffMe | null> {
    const token = this.token();
    if (!token) return null;
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
    this.restoring = Promise.resolve(false);
  }

  private setSession(s: StaffSessionResponse): void {
    this.token.set(s.accessToken);
    this.staff.set(s.staff);
    this.restoring = Promise.resolve(true);
  }
}
