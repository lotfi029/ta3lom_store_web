import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminPaymentAction,
  AdminCustomer,
  AdminCustomerPage,
  AdminOrderDetail,
  AdminOrderPage,
  AdminOrderRow,
  CustomerStatus,
  Dashboard,
  OrderStatusValue,
} from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';

export interface OrderFilter {
  reference: string;
  mobile: string;
  status: '' | OrderStatusValue;
  /** `YYYY-MM-DD`, Riyadh calendar days, inclusive (contract 15 §1.4). */
  from: string;
  to: string;
  page: number;
}

export interface DonorFilter {
  q: string;
  status: '' | CustomerStatus;
  page: number;
}

export const PAGE_SIZE = 20;

/** References in their canonical upper case, for the search query, links and display (the API matches any case). */
export const upperRef = (s: string): string => s.trim().toUpperCase();

/** Order filter → query parameters (blank fields left out). */
export function orderParams(f: OrderFilter): Record<string, string | number> {
  const params: Record<string, string | number> = { page: f.page, pageSize: PAGE_SIZE };
  if (f.reference.trim()) params['reference'] = upperRef(f.reference);
  if (f.mobile.trim()) params['mobile'] = f.mobile.trim();
  if (f.status) params['status'] = f.status;
  if (f.from) params['from'] = f.from;
  if (f.to) params['to'] = f.to;
  return params;
}

/**
 * Admin operations (contract 15 §2.8): dashboard, donors (search, detail, block/unblock) and orders (search, detail,
 * cancel a pending order). Reads need `staff:read`; block/unblock `staff:customers`; cancel `staff:orders`.
 */
@Injectable({ providedIn: 'root' })
export class OpsData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private readonly on = computed(() => this.auth.isSignedIn() && this.auth.can('staff:read'));

  readonly dashboard = httpResource<Dashboard>(() =>
    this.on() ? `${this.api}/admin/dashboard` : undefined,
  );

  readonly orderFilter = signal<OrderFilter>({
    reference: '',
    mobile: '',
    status: '',
    from: '',
    to: '',
    page: 1,
  });
  readonly orders = httpResource<AdminOrderPage>(() =>
    this.on()
      ? { url: `${this.api}/admin/orders`, params: orderParams(this.orderFilter()) }
      : undefined,
  );

  readonly orderRef = signal<string | null>(null);
  readonly order = httpResource<AdminOrderDetail>(() => {
    const ref = this.orderRef();
    return this.on() && ref
      ? `${this.api}/admin/orders/${encodeURIComponent(upperRef(ref))}`
      : undefined;
  });

  readonly donorFilter = signal<DonorFilter>({ q: '', status: '', page: 1 });
  readonly donors = httpResource<AdminCustomerPage>(() => {
    if (!this.on()) return undefined;
    const f = this.donorFilter();
    const params: Record<string, string | number> = { page: f.page, pageSize: PAGE_SIZE };
    if (f.q.trim()) params['q'] = f.q.trim();
    if (f.status) params['status'] = f.status;
    return { url: `${this.api}/admin/customers`, params };
  });

  readonly donorId = signal<string | null>(null);
  readonly donor = httpResource<AdminCustomer>(() => {
    const id = this.donorId();
    return this.on() && id ? `${this.api}/admin/customers/${encodeURIComponent(id)}` : undefined;
  });

  /**
   * `POST /admin/orders/{ref}/cancel` (only `pending_payment`). A refusal is 409 `order.cancel_not_allowed` with the
   * order's state in `orderStatus`; the client reads only `code` and reloads the order.
   */
  async cancelOrder(reference: string): Promise<AdminOrderRow> {
    const r = await firstValueFrom(
      this.http.post<AdminOrderRow>(
        `${this.api}/admin/orders/${encodeURIComponent(upperRef(reference))}/cancel`,
        null,
      ),
    );
    this.order.reload();
    this.orders.reload();
    this.dashboard.reload();
    return r;
  }

  // ── R5-Payments (plan §4, §6 F5): finance actions. Each Idempotency-Key is created by the dialog and kept by it
  // until a definite answer; the order's `version` (as read) guards against concurrent changes (409).

  async refund(reference: string, amount: string, reason: string, version: number, key: string): Promise<AdminPaymentAction> {
    return this.financeAction(`${this.orderPath(reference)}/refunds`, { amount, reason, version }, key);
  }

  async acceptReview(reference: string, version: number): Promise<AdminPaymentAction> {
    return this.financeAction(`${this.orderPath(reference)}/review/accept`, { version, reason: null });
  }

  async refundReview(reference: string, version: number, reason: string, key: string): Promise<AdminPaymentAction> {
    return this.financeAction(`${this.orderPath(reference)}/review/refund`, { version, reason }, key);
  }

  async resendReceipt(reference: string, key: string): Promise<AdminPaymentAction> {
    return this.financeAction(`${this.orderPath(reference)}/receipt/resend`, {}, key);
  }

  /** `GET /admin/reports/donations.csv?from&to` (Riyadh dates, `staff:finance`) as a file. */
  async donationsCsv(from: string, to: string): Promise<{ blob: Blob; fileName: string }> {
    const res = await firstValueFrom(
      this.http.get(`${this.api}/admin/reports/donations.csv`, {
        params: { from, to },
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `donations-${from}-${to}.csv`;
    return { blob: res.body!, fileName: name };
  }

  private orderPath(reference: string): string {
    return `${this.api}/admin/orders/${encodeURIComponent(upperRef(reference))}`;
  }

  private async financeAction(url: string, body: object, key?: string): Promise<AdminPaymentAction> {
    const r = await firstValueFrom(
      this.http.post<AdminPaymentAction>(url, body, key ? { headers: { 'Idempotency-Key': key } } : {}),
    );
    this.order.reload();
    this.orders.reload();
    this.dashboard.reload();
    return r;
  }

  async setBlocked(id: string, blocked: boolean): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.api}/admin/customers/${encodeURIComponent(id)}/${blocked ? 'block' : 'unblock'}`,
        null,
      ),
    );
    this.donor.reload();
    this.donors.reload();
  }
}
