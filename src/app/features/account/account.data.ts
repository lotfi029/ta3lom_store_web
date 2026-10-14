import { isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Address,
  AddressInput,
  BooksResponse,
  DownloadLink,
  Enrolment,
  LaunchResponse,
  OrderDetail,
  OrderPage,
  Profile,
  RequestBody,
  UpdateProfile,
} from '../../core/api/api.types';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { StoreAuth } from '../../core/auth/store-auth';
import { valueOf } from '../../core/http/resource-value';

export const ORDERS_PAGE_SIZE = 10;

/**
 * The customer account (11 §5, #21–#32, #35–#39). Reads are `httpResource`s keyed on the session; writes reload the
 * resource they change. Root-provided but only imported by the lazy account routes, so it ships in their chunk.
 */
@Injectable({ providedIn: 'root' })
export class AccountData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StoreAuth);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly on = computed(() => this.browser && this.auth.isSignedIn());
  private url(path: string): string | undefined {
    return this.on() ? `${this.api}${path}` : undefined;
  }

  readonly profile = httpResource<Profile>(() => this.url('/me'));
  readonly enrolments = httpResource<Enrolment[]>(() => this.url('/me/enrolments'));
  readonly books = httpResource<BooksResponse>(() => this.url('/me/books'));
  readonly addresses = httpResource<Address[]>(() => this.url('/me/addresses'));
  readonly ordersPage = signal(1);
  readonly orders = httpResource<OrderPage>(() =>
    this.on()
      ? {
          url: `${this.api}/me/orders`,
          params: { page: this.ordersPage(), pageSize: ORDERS_PAGE_SIZE },
        }
      : undefined,
  );

  /** Tab counts for the side menu (prototype `.acct-side .c`). */
  readonly counts = computed(() => {
    const books = valueOf(this.books);
    return {
      courses: valueOf(this.enrolments)?.length ?? null,
      books: books ? books.downloads.length + books.shipments.length : null,
      orders: valueOf(this.orders)?.total ?? null,
    };
  });

  order(ref: string): Promise<OrderDetail> {
    return firstValueFrom(
      this.http.get<OrderDetail>(`${this.api}/me/orders/${encodeURIComponent(ref)}`),
    );
  }

  async updateProfile(body: UpdateProfile): Promise<Profile> {
    const p = await firstValueFrom(this.http.patch<Profile>(`${this.api}/me`, body));
    this.profile.set(p);
    const c = this.auth.customer();
    if (c) this.auth.customer.set({ ...c, fullName: p.fullName, email: p.email, locale: p.locale });
    return p;
  }

  async saveAddress(id: string | null, body: AddressInput): Promise<Address> {
    const a = id
      ? await firstValueFrom(this.http.put<Address>(`${this.api}/me/addresses/${id}`, body))
      : await firstValueFrom(this.http.post<Address>(`${this.api}/me/addresses`, body));
    this.addresses.reload();
    return a;
  }

  async deleteAddress(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/me/addresses/${id}`));
    this.addresses.reload();
  }

  async setDefaultAddress(id: string): Promise<void> {
    await firstValueFrom(this.http.post<Address>(`${this.api}/me/addresses/${id}/default`, null));
    this.addresses.reload();
  }

  /** #29: a short-lived start/resume link from the LMS (RUL-42). */
  launch(enrolmentId: string): Promise<LaunchResponse> {
    return firstValueFrom(
      this.http.post<LaunchResponse>(`${this.api}/me/enrolments/${enrolmentId}/launch`, null),
    );
  }

  /** #32: a signed 10-minute link (`/v1/downloads/{token}`, #46); counts one of the 5 downloads (RUL-41). */
  async downloadLink(grantId: string): Promise<DownloadLink> {
    const link = await firstValueFrom(
      this.http.post<DownloadLink>(`${this.api}/me/downloads/${grantId}/link`, null),
    );
    this.books.reload();
    return link;
  }

  /** #37: an invoice / credit note PDF (needs the bearer, so it is fetched, not linked). */
  document(number: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.api}/me/documents/${encodeURIComponent(number)}`, {
        responseType: 'blob',
      }),
    );
  }

  /** #38: everything the store holds about the customer, as JSON (FR-S27). */
  exportData(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.api}/me/export`, { responseType: 'blob' }));
  }

  /** #39: anonymises the account (RUL-61); the API clears the refresh cookie, the app clears the token. */
  async deleteAccount(): Promise<void> {
    const body: RequestBody<'/v1/me', 'delete'> = { confirm: true };
    await firstValueFrom(this.http.delete(`${this.api}/me`, { body }));
    this.auth.clear();
  }
}
