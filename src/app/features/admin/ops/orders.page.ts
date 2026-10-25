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
import { type OrderStatusValue, toInt } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { OpsData, type OrderFilter, PAGE_SIZE } from './ops.data';

/** Order states the admin filter offers (contract 15 §1.9; R5-Core sets only pending and cancelled). */
export const ORDER_STATUSES: readonly OrderStatusValue[] = [
  'pending_payment',
  'cancelled',
  'paid',
  'payment_review',
  'expired',
];

const isStatus = (s: string | undefined): s is OrderStatusValue =>
  !!s && (ORDER_STATUSES as readonly string[]).includes(s);

/** `from ≤ to` when both are set (the API answers 400 otherwise). */
export const rangeOk = (from: string, to: string): boolean => !from || !to || from <= to;

/** Donation orders (contract 15 §2.8): reference, donor mobile, status and Riyadh dates (inclusive). */
@Component({
  selector: 'ta-admin-orders',
  imports: [RouterLink, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrls: ['../admin-common.css'],
})
export class AdminOrdersPage {
  /** `?status=` from the dashboard link. */
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
  protected readonly rangeError = signal(false);
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
        if (isStatus(s)) {
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
    const d = this.draft();
    this.rangeError.set(!rangeOk(d.from, d.to));
    if (this.rangeError()) return;
    this.data.orderFilter.set({ ...d, page: 1 });
  }

  protected go(page: number): void {
    this.data.orderFilter.update((f) => ({
      ...f,
      page: Math.min(this.pages(), Math.max(1, page)),
    }));
  }
}
