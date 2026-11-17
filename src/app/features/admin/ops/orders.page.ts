import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type OrderStatusValue, toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StoreConfig } from '../../../core/api/store-config';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { saveFile } from '../../../core/http/save-file';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { normalizeSaudiMobile } from '../../../core/i18n/western-digits';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { orderStatus } from '../../../shared/ui/status-pill/status-labels';
import { validRange } from '../reports/reports.page';
import { AdminBadge, badgeKind } from '../ui/badge';
import { type ViewTab, ViewTabs } from '../ui/index-page/view-tabs';
import { Requires } from '../ui/requires';
import { AdminViewport } from '../ui/viewport';
import { OpsData, type OrderFilter, PAGE_SIZE, upperRef } from './ops.data';
import { OrderDetail } from './order-detail';

/** Order states the admin filter offers (contract 15 §1.9); the status views follow this order (02 §4). */
export const ORDER_STATUSES: readonly OrderStatusValue[] = [
  'pending_payment',
  'payment_review',
  'paid',
  'cancelled',
  'expired',
];

const isStatus = (s: string | undefined): s is OrderStatusValue =>
  !!s && (ORDER_STATUSES as readonly string[]).includes(s);

/** `from ≤ to` when both are set (the API answers 400 otherwise). */
export const rangeOk = (from: string, to: string): boolean => !from || !to || from <= to;

/** One search box for both (03 §6): a Saudi mobile searches `mobile`, anything else is a `reference`. */
export function searchFields(text: string): Pick<OrderFilter, 'reference' | 'mobile'> {
  const t = text.trim();
  if (!t) return { reference: '', mobile: '' };
  const mobile = normalizeSaudiMobile(t);
  return mobile ? { reference: '', mobile } : { reference: upperRef(t), mobile: '' };
}

/** Wide enough for the list + detail side by side (02 §3: the panel is hidden ≤ 1100px). */
const SPLIT_QUERY = '(width > 1100px)';

/**
 * Donations (docs/admin-redesign/02 §2, mockups D/P-Orders; contract 15 §2.8): status views with the dashboard's
 * pending / in-review counts, one search box (reference or mobile), Riyadh dates (inclusive), the finance CSV for the
 * chosen dates, a table (card list on phones) and, on wide screens, the selected donation in a side panel
 * (`?ref=` keeps it deep-linkable; `/admin/orders/:ref` stays the full page).
 */
@Component({
  selector: 'ta-admin-orders',
  imports: [RouterLink, Money, ResourceState, AdminBadge, ViewTabs, Requires, Icon, OrderDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
  styleUrls: ['../admin-common.css', './orders.page.css'],
})
export class AdminOrdersPage {
  /** `?status=` from the dashboard and the side nav; no status = all (the nav's «كل التبرعات»). */
  readonly status = input<string | undefined>();
  /** `?mobile=` / `?reference=` from the command palette (W-A1). */
  readonly mobile = input<string | undefined>();
  readonly reference = input<string | undefined>();
  /** `?ref=`: the donation open in the side panel (W-A4). */
  readonly ref = input<string | undefined>();

  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  protected readonly viewport = inject(AdminViewport);
  private readonly router = inject(Router);
  private readonly config = inject(StoreConfig);
  private readonly seo = inject(SeoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly page = computed(() => valueOf(this.data.orders));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / PAGE_SIZE)),
  );
  protected readonly q = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly rangeError = signal(false);
  protected readonly label = orderStatus;
  protected readonly kind = badgeKind;
  protected readonly int = toInt;
  protected readonly paymentsOff = computed(() => this.config.paymentsEnabled() === false);
  protected readonly wide = signal(this.browser && window.matchMedia(SPLIT_QUERY).matches);
  protected readonly selected = computed(() =>
    this.wide() && this.ref() ? upperRef(this.ref()!) : null,
  );

  private readonly dash = computed(() => valueOf(this.data.dashboard));
  protected readonly tabs = computed<ViewTab[]>(() => {
    const d = this.dash();
    const n = (v: number | string | null | undefined) =>
      v === null || v === undefined ? null : toInt(v);
    return [
      { key: '', label: $localize`:@@store.admin.all:الكل` },
      ...ORDER_STATUSES.map((s) => ({
        key: s,
        label: orderStatus(s).label,
        count:
          s === 'pending_payment'
            ? n(d?.pendingOrders)
            : s === 'payment_review'
              ? n(d?.inReviewOrders)
              : null,
      })),
    ];
  });

  // CSV (03 §13.10): the finance report for the chosen dates.
  protected readonly canExport = computed(() => this.auth.can('staff:finance'));
  protected readonly exportReady = computed(() => validRange(this.from(), this.to()));
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.admin.nav-donations:التبرعات`,
      description: '',
      path: '/admin/orders',
      noindex: true,
    });
    const f = this.data.orderFilter();
    this.q.set(f.reference || f.mobile);
    this.from.set(f.from);
    this.to.set(f.to);
    if (this.browser) {
      const mq = window.matchMedia(SPLIT_QUERY);
      const on = (e: MediaQueryListEvent) => this.wide.set(e.matches);
      mq.addEventListener('change', on);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
    }
    effect(() => {
      const s = this.status();
      const mobile = this.mobile();
      const reference = this.reference();
      untracked(() => {
        const f = this.data.orderFilter();
        const next: OrderFilter = {
          ...f,
          status: isStatus(s) ? s : '',
          ...(mobile !== undefined ? { mobile, reference: '' } : {}),
          ...(reference !== undefined ? { reference: upperRef(reference), mobile: '' } : {}),
          page: 1,
        };
        if (
          next.status !== f.status ||
          next.mobile !== f.mobile ||
          next.reference !== f.reference
        ) {
          this.q.set(next.reference || next.mobile);
          this.data.orderFilter.set(next);
        } else this.data.orders.reload();
      });
    });
    this.data.dashboard.reload();
  }

  protected setStatus(s: string): void {
    void this.router.navigate([], {
      queryParams: { status: s || null, ref: null },
      queryParamsHandling: 'merge',
    });
  }

  protected apply(e: Event): void {
    e.preventDefault();
    this.rangeError.set(!rangeOk(this.from(), this.to()));
    if (this.rangeError()) return;
    this.data.orderFilter.update((f) => ({
      ...f,
      ...searchFields(this.q()),
      from: this.from(),
      to: this.to(),
      page: 1,
    }));
  }

  protected go(page: number): void {
    this.data.orderFilter.update((f) => ({
      ...f,
      page: Math.min(this.pages(), Math.max(1, page)),
    }));
  }

  /** Wide screens open the row in the side panel; elsewhere the link goes to the full page. */
  protected open(e: MouseEvent, reference: string): void {
    if (!this.wide() || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    void this.router.navigate([], {
      queryParams: { ref: reference },
      queryParamsHandling: 'merge',
    });
  }

  protected closePanel(): void {
    void this.router.navigate([], { queryParams: { ref: null }, queryParamsHandling: 'merge' });
  }

  protected async exportCsv(): Promise<void> {
    if (!this.exportReady() || this.exporting() || !this.canExport()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      const { blob, fileName } = await this.data.donationsCsv(this.from(), this.to());
      saveFile(blob, fileName);
    } catch (err) {
      this.exportError.set(problemMessage(toProblem(err)));
    } finally {
      this.exporting.set(false);
    }
  }
}
