import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toInt } from '../../core/api/api.types';
import { valueOf } from '../../core/http/resource-value';
import { I18nService } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { Money } from '../../shared/ui/money/money';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { AccountData, ORDERS_PAGE_SIZE } from './account.data';
import { orderStatus } from './labels';

/** Orders and invoices (FR-S26, #35): newest first, paged. */
@Component({
  selector: 'ta-account-orders',
  imports: [RouterLink, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  protected readonly page = computed(() => valueOf(this.data.orders));
  protected readonly items = computed(() => this.page()?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(this.page()?.total) / ORDERS_PAGE_SIZE)),
  );
  protected readonly status = orderStatus;
  protected readonly int = toInt;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.tab-orders:الطلبات والفواتير`,
      description: $localize`:@@store.account.seo-description:حسابك في متجر جمعية التعلم الإلكتروني.`,
      path: '/account/orders',
      noindex: true,
    });
    this.data.orders.reload();
  }

  protected go(page: number): void {
    this.data.ordersPage.set(Math.min(this.pages(), Math.max(1, page)));
  }
}
