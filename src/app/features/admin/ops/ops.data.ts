import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminOrderDetail,
  AdminOrderPage,
  Customer360,
  CustomerRow,
  Dashboard,
  DownloadGrant,
  Shipment,
  ShipmentPage,
  StockMovementPage,
  StockMovementRequest,
  StockRow,
} from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StaffAuth } from '../../../core/auth/staff-auth';

export interface OrderFilter {
  q: string;
  status: string;
  from: string;
  to: string;
  page: number;
}

export type ReportName = 'sales' | 'vat' | 'shipments';
export const PAGE_SIZE = 20;

/**
 * Admin operations (#53, #78–#80, #85–#88, #94–#99, #117, #129–#132): dashboard, orders, shipments, stock, download
 * resets, customers and reports. r4: purchase orders only (`kind=buy`), reports sales / VAT / shipments.
 */
@Injectable({ providedIn: 'root' })
export class OpsData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StaffAuth);
  private readonly on = computed(() => this.auth.isSignedIn());

  readonly dashboard = httpResource<Dashboard>(() =>
    this.on() ? `${this.api}/admin/dashboard` : undefined,
  );
  readonly lowStock = httpResource<StockRow[]>(() =>
    this.on() ? { url: `${this.api}/admin/stock`, params: { lowOnly: 'true' } } : undefined,
  );

  readonly orderFilter = signal<OrderFilter>({ q: '', status: '', from: '', to: '', page: 1 });
  readonly orders = httpResource<AdminOrderPage>(() => {
    if (!this.on()) return undefined;
    const f = this.orderFilter();
    const params: Record<string, string | number> = {
      page: f.page,
      pageSize: PAGE_SIZE,
      kind: 'buy',
    };
    if (f.q.trim()) params['q'] = f.q.trim();
    if (f.status) params['status'] = f.status;
    if (f.from) params['from'] = f.from;
    if (f.to) params['to'] = f.to;
    return { url: `${this.api}/admin/orders`, params };
  });

  readonly shipmentStatus = signal('preparing');
  readonly shipmentPage = signal(1);
  readonly shipments = httpResource<ShipmentPage>(() =>
    this.on()
      ? {
          url: `${this.api}/admin/shipments`,
          params: { status: this.shipmentStatus(), page: this.shipmentPage(), pageSize: PAGE_SIZE },
        }
      : undefined,
  );

  readonly lowOnly = signal(false);
  readonly stock = httpResource<StockRow[]>(() => {
    if (!this.on()) return undefined;
    const params: Record<string, string> = this.lowOnly() ? { lowOnly: 'true' } : {};
    return { url: `${this.api}/admin/stock`, params };
  });

  order(ref: string): Promise<AdminOrderDetail> {
    return firstValueFrom(
      this.http.get<AdminOrderDetail>(`${this.api}/admin/orders/${encodeURIComponent(ref)}`),
    );
  }

  cancel(ref: string, reason: string): Promise<AdminOrderDetail> {
    return firstValueFrom(
      this.http.post<AdminOrderDetail>(
        `${this.api}/admin/orders/${encodeURIComponent(ref)}/cancel`,
        { reason },
      ),
    );
  }

  resend(ref: string, channels: string[]): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.api}/admin/orders/${encodeURIComponent(ref)}/resend-documents`, {
        channels,
      }),
    );
  }

  resetGrant(id: string, reason: string): Promise<DownloadGrant> {
    return firstValueFrom(
      this.http.post<DownloadGrant>(
        `${this.api}/admin/download-grants/${encodeURIComponent(id)}/reset`,
        { reason },
      ),
    );
  }

  packingSlip(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.api}/admin/shipments/${id}/packing-slip`, { responseType: 'blob' }),
    );
  }

  async ship(id: string, carrier: string, trackingNo: string): Promise<Shipment> {
    const s = await firstValueFrom(
      this.http.post<Shipment>(`${this.api}/admin/shipments/${id}/ship`, { carrier, trackingNo }),
    );
    this.shipments.reload();
    return s;
  }

  async deliver(id: string, deliveredOn: string | null): Promise<Shipment> {
    const s = await firstValueFrom(
      this.http.post<Shipment>(`${this.api}/admin/shipments/${id}/deliver`, { deliveredOn }),
    );
    this.shipments.reload();
    return s;
  }

  async returnShipment(id: string, note: string, restock: boolean): Promise<Shipment> {
    const s = await firstValueFrom(
      this.http.post<Shipment>(`${this.api}/admin/shipments/${id}/return`, { note, restock }),
    );
    this.shipments.reload();
    return s;
  }

  movements(formatId: string, page = 1): Promise<StockMovementPage> {
    return firstValueFrom(
      this.http.get<StockMovementPage>(`${this.api}/admin/stock/${formatId}/movements`, {
        params: { page, pageSize: 10 },
      }),
    );
  }

  async move(formatId: string, body: StockMovementRequest): Promise<StockRow> {
    const r = await firstValueFrom(
      this.http.post<StockRow>(`${this.api}/admin/stock/${formatId}/movements`, body),
    );
    this.stock.reload();
    return r;
  }

  findCustomers(by: { mobile?: string; email?: string }): Promise<CustomerRow[]> {
    const params: Record<string, string> = {};
    if (by.mobile) params['mobile'] = by.mobile;
    if (by.email) params['email'] = by.email;
    return firstValueFrom(this.http.get<CustomerRow[]>(`${this.api}/admin/customers`, { params }));
  }

  customer(id: string): Promise<Customer360> {
    return firstValueFrom(this.http.get<Customer360>(`${this.api}/admin/customers/${id}`));
  }

  block(id: string, reason: string): Promise<CustomerRow> {
    return firstValueFrom(
      this.http.post<CustomerRow>(`${this.api}/admin/customers/${id}/block`, { reason }),
    );
  }

  unblock(id: string): Promise<CustomerRow> {
    return firstValueFrom(
      this.http.post<CustomerRow>(`${this.api}/admin/customers/${id}/unblock`, null),
    );
  }

  report(
    name: ReportName,
    from: string,
    to: string,
  ): Promise<{ name: string; from: string; to: string; rows: Record<string, unknown>[] }> {
    return firstValueFrom(
      this.http.get<{ name: string; from: string; to: string; rows: Record<string, unknown>[] }>(
        `${this.api}/admin/reports/${name}`,
        {
          params: { from, to, format: 'json' },
        },
      ),
    );
  }

  /** The API's CSV (UTF-8 with BOM, snake_case header) as a file. */
  reportCsv(name: ReportName, from: string, to: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.api}/admin/reports/${name}`, {
        params: { from, to, format: 'csv' },
        responseType: 'blob',
      }),
    );
  }
}
