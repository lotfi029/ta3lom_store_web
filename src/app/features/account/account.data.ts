import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  DonationDetail,
  DonationPage,
  Me,
  MeExport,
  UpdateMe,
} from '../../core/api/api.types';
import { toInt } from '../../core/api/api.types';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { StoreAuth } from '../../core/auth/store-auth';
import { CartStore } from '../../core/cart/cart-store';
import { valueOf } from '../../core/http/resource-value';

export const DONATIONS_PAGE_SIZE = 10;

/** API-2: `/v1/me/donations/{reference}` matches case-sensitively; references are stored upper-case. */
export const donationUrl = (api: string, ref: string): string =>
  `${api}/me/donations/${encodeURIComponent(ref.trim().toUpperCase())}`;

/**
 * The donor account (contract 15 §2.5): profile (`GET/PATCH /v1/me`), donations (paged list + detail), data export,
 * account deletion (anonymises, keeps the orders) and sign-out everywhere. Provided by the account shell.
 */
@Injectable()
export class AccountData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StoreAuth);
  private readonly cart = inject(CartStore);

  readonly profile = httpResource<Me>(() =>
    this.auth.isSignedIn() ? `${this.api}/me` : undefined,
  );
  readonly me = computed(() => valueOf(this.profile));

  readonly page = signal(1);
  readonly donations = httpResource<DonationPage>(() =>
    this.auth.isSignedIn()
      ? {
          url: `${this.api}/me/donations`,
          params: { page: this.page(), pageSize: DONATIONS_PAGE_SIZE },
        }
      : undefined,
  );
  readonly donationsTotal = computed(() => {
    const v = valueOf(this.donations);
    return v ? toInt(v.total) : null;
  });

  readonly ref = signal('');
  readonly detail = httpResource<DonationDetail>(() =>
    this.auth.isSignedIn() && this.ref() ? donationUrl(this.api, this.ref()) : undefined,
  );

  /** `PATCH /v1/me`: null leaves a field, "" clears name/e-mail. The menu and checkout follow at once. */
  async updateMe(body: UpdateMe): Promise<Me> {
    const me = await firstValueFrom(this.http.patch<Me>(`${this.api}/me`, body));
    this.profile.set(me);
    this.auth.setProfile(me);
    return me;
  }

  /** `GET /v1/me/export` → a JSON file (profile + every donation with its lines). */
  async exportData(): Promise<Blob> {
    const data = await firstValueFrom(this.http.get<MeExport>(`${this.api}/me/export`));
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }

  /** `DELETE /v1/me`: anonymises the donor (orders kept), revokes the sessions; locally: signed out, cart emptied. */
  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/me`));
    this.auth.clear();
    this.cart.reset();
  }

  /**
   * Sign out everywhere: refresh first (the access token may be minutes old and `logout-all` needs a valid one), then
   * `POST /v1/auth/logout-all`, which revokes every session family and clears the refresh cookie.
   */
  async logoutAll(): Promise<void> {
    try {
      await this.auth.refresh();
    } catch {
      /* already signed out: logoutAll clears the local session below */
    }
    await this.auth.logoutAll();
    this.cart.reset();
  }
}
