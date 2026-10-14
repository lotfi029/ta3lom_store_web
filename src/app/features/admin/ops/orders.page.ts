import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AdminOrderRow } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { OpsData, type OrderFilter, PAGE_SIZE } from './ops.data';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'fulfilled',
  'payment_failed',
  'payment_review',
  'expired',
  'cancelled',
  'refunded',
  'partially_refunded',
];

/** Orders (#85, FR-S73): search by reference or mobile, status and Riyadh dates; purchase orders only (r4). */
@Component({
  selector: 'ta-admin-orders',
  imports: [RouterLink, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrls: ['../admin-common.css'],
})
export class AdminOrdersPage {
  readonly status = input<string | undefined>();

  protected readonly data = inject(OpsData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.orders));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PAGE_SIZE)),
  );
  protected readonly draft = signal<Omit<OrderFilter, 'page'>>({ ...this.data.orderFilter() });
  protected readonly statuses = ORDER_STATUSES;
  protected readonly label = orderStatus;
  protected readonly int = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-orders:الطلبات`,
      description: '',
      path: '/admin/orders',
      noindex: true,
    });
    effect(() => {
      const s = this.status();
      untracked(() => {
        if (s !== undefined) {
          this.draft.update((d) => ({ ...d, status: s }));
          this.data.orderFilter.set({ ...this.draft(), page: 1 });
        } else this.data.orders.reload();
      });
    });
  }

  protected set(field: keyof Omit<OrderFilter, 'page'>, e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((d) => ({ ...d, [field]: v }));
  }

  protected apply(e: Event): void {
    e.preventDefault();
    this.data.orderFilter.set({ ...this.draft(), page: 1 });
  }

  protected go(page: number): void {
    this.data.orderFilter.update((f) => ({
      ...f,
      page: Math.min(this.pages(), Math.max(1, page)),
    }));
  }

  protected key(o: AdminOrderRow): string {
    return o.reference;
  }
}
