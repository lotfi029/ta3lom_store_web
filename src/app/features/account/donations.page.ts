import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toInt } from '../../core/api/api.types';
import { valueOf } from '../../core/http/resource-value';
import { I18nService } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { Money } from '../../shared/ui/money/money';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { orderStatus } from '../../shared/ui/status-pill/status-labels';
import { AccountData, DONATIONS_PAGE_SIZE } from './account.data';

/** `/account/donations` (W-M4): the donor's donations, newest first, paged (`GET /v1/me/donations`). */
@Component({
  selector: 'ta-donations-page',
  imports: [RouterLink, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabh"><h2 i18n="@@store.layout.my-donations">تبرعاتي</h2></div>
    <ta-resource-state
      [loading]="data.donations.isLoading() && !data.donations.hasValue()"
      [error]="!!data.donations.error()"
      (retry)="data.donations.reload()"
    >
      @if (items().length === 0) {
        <div class="acct-empty">
          <p i18n="@@store.account.no-donations">لم تتبرع بعد. اختر مشروعًا وابدأ.</p>
          <a class="b primary" routerLink="/" fragment="projects" i18n="@@store.layout.nav-projects"
            >المشاريع</a
          >
        </div>
      } @else {
        <div class="tblwrap">
          <table class="tbl">
            <caption class="visually-hidden" i18n="@@store.layout.my-donations">
              تبرعاتي
            </caption>
            <thead>
              <tr>
                <th scope="col" i18n="@@store.order.reference">الرقم المرجعي</th>
                <th scope="col" i18n="@@store.order.created">التاريخ</th>
                <th scope="col" i18n="@@store.cart.lines">عدد التبرعات</th>
                <th scope="col" i18n="@@store.cart.total">الإجمالي</th>
                <th scope="col" i18n="@@store.order.status">الحالة</th>
              </tr>
            </thead>
            <tbody>
              @for (d of items(); track d.reference) {
                <tr>
                  <td>
                    <a [routerLink]="['/account/donations', d.reference]"
                      ><bdi dir="ltr" class="mono">{{ d.reference }}</bdi></a
                    >
                  </td>
                  <td>{{ i18n.formatDate(d.createdAt) }}</td>
                  <td>{{ d.lineCount }}</td>
                  <td><ta-money [value]="d.totalAmount" /></td>
                  <td>
                    <ta-status-pill [tone]="status(d.status).tone">{{
                      status(d.status).label
                    }}</ta-status-pill>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (pages() > 1) {
          <nav
            class="pager"
            aria-label="ترقيم الصفحات"
            i18n-aria-label="@@store.ui.data-table-pager-label"
          >
            @for (n of pageNumbers(); track n) {
              @if (n === data.page()) {
                <span aria-current="page">{{ n }}</span>
              } @else {
                <button type="button" (click)="data.page.set(n)">{{ n }}</button>
              }
            }
          </nav>
        }
      }
    </ta-resource-state>
  `,
  styles: `
    .pager button {
      min-inline-size: 44px;
      min-block-size: 44px;
      border-radius: var(--rp);
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text);
      font: inherit;
      cursor: pointer;
    }
  `,
})
export class DonationsPage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  protected readonly items = computed(() => valueOf(this.data.donations)?.items ?? []);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(toInt(valueOf(this.data.donations)?.total) / DONATIONS_PAGE_SIZE)),
  );
  protected readonly pageNumbers = computed(() =>
    Array.from({ length: this.pages() }, (_, i) => i + 1),
  );
  protected readonly status = orderStatus;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.layout.my-donations:تبرعاتي`,
      description: $localize`:@@store.layout.my-donations:تبرعاتي`,
      path: '/account/donations',
      noindex: true,
    });
  }
}
