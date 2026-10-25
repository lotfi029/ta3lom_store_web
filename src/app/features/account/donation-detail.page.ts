import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import type { DonationLine } from '../../core/api/api.types';
import { valueOf } from '../../core/http/resource-value';
import { I18nService } from '../../core/i18n/i18n';
import { SeoService } from '../../core/seo/seo.service';
import { environment } from '../../../environments/environment';
import { Money } from '../../shared/ui/money/money';
import { ResourceState } from '../../shared/ui/resource-state/resource-state';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { orderStatus } from '../../shared/ui/status-pill/status-labels';
import { AccountData } from './account.data';

/** `/account/donations/:ref` (W-M4): one donation — status, lines, totals, contact snapshot (`GET /v1/me/donations/{ref}`). */
@Component({
  selector: 'ta-donation-detail-page',
  imports: [RouterLink, Money, ResourceState, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabh">
      <h2>
        <span i18n="@@store.account.donation">التبرع</span>
        <bdi dir="ltr" class="mono">{{ ref().toUpperCase() }}</bdi>
      </h2>
      <a routerLink="/account/donations" i18n="@@store.account.back-to-donations">كل تبرعاتي</a>
    </div>
    @if (notFound()) {
      <p class="banner err" role="alert" i18n="@@store.error.order-not-found">لم نجد هذا التبرع.</p>
    } @else {
      <ta-resource-state
        [loading]="data.detail.isLoading() && !data.detail.hasValue()"
        [error]="!!data.detail.error()"
        (retry)="data.detail.reload()"
      >
        @if (d(); as d) {
          <div class="meta">
            <ta-status-pill [tone]="status(d.status).tone">{{
              status(d.status).label
            }}</ta-status-pill>
            <span>{{ i18n.formatDateTime(d.createdAt) }}</span>
          </div>
          @if (d.status === 'pending_payment' && !paymentsEnabled) {
            <p class="banner info" role="note" i18n="@@store.order.registered">
              تم تسجيل تبرعك — الدفع الإلكتروني قريبًا
            </p>
          }
          <div class="tblwrap">
            <table class="tbl">
              <caption class="visually-hidden" i18n="@@store.account.lines-caption">
                بنود التبرع
              </caption>
              <thead>
                <tr>
                  <th scope="col" i18n="@@store.account.line">التبرع</th>
                  <th scope="col" i18n="@@store.donate.qty-label">الكمية</th>
                  <th scope="col" i18n="@@store.cart.total">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                @for (l of d.lines; track l.lineNo) {
                  <tr>
                    <td>
                      {{ lineTitle(l) }}
                      @if (l.optionLabelAr) {
                        <small class="muted">{{
                          i18n.pick(l.optionLabelAr, l.optionLabelEn)
                        }}</small>
                      }
                    </td>
                    <td>{{ l.quantity }} × <ta-money [value]="l.unitAmount" /></td>
                    <td><ta-money [value]="l.amount" /></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colspan="2" i18n="@@store.cart.total">الإجمالي</th>
                  <td>
                    <b><ta-money [value]="d.totalAmount" /></b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <dl class="contact">
            <div>
              <dt i18n="@@store.checkout.name">الاسم الكامل</dt>
              <dd>{{ d.donorName }}</dd>
            </div>
            <div>
              <dt i18n="@@store.checkout.email">البريد الإلكتروني</dt>
              <dd>
                <bdi dir="ltr">{{ d.donorEmail }}</bdi>
              </dd>
            </div>
            @if (d.cancelledAt) {
              <div>
                <dt i18n="@@store.account.cancelled-at">أُلغي في</dt>
                <dd>{{ i18n.formatDateTime(d.cancelledAt) }}</dd>
              </div>
            }
          </dl>
        }
      </ta-resource-state>
    }
  `,
  styles: `
    .tabh {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .tabh a {
      color: var(--c-link);
      min-block-size: 44px;
      display: inline-flex;
      align-items: center;
    }
    .meta {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-block-end: 14px;
      color: var(--c-text-2);
    }
    td small {
      display: block;
    }
    .contact {
      display: grid;
      gap: 10px;
      margin-block: 18px 0;
    }
    .contact dt {
      font-size: 0.82rem;
      color: var(--c-text-2);
    }
    .contact dd {
      margin: 0;
    }
  `,
})
export class DonationDetailPage {
  protected readonly data = inject(AccountData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  readonly ref = input.required<string>();
  protected readonly paymentsEnabled = environment.paymentsEnabled;
  protected readonly d = computed(() => valueOf(this.data.detail));
  protected readonly notFound = computed(() => {
    const e = this.data.detail.error();
    return e instanceof HttpErrorResponse && e.status === 404;
  });
  protected readonly status = orderStatus;

  constructor() {
    this.seo.set({
      title: $localize`:@@store.account.donation:التبرع`,
      description: $localize`:@@store.account.donation:التبرع`,
      path: '/account/donations',
      noindex: true,
    });
    effect(() => {
      const r = this.ref();
      untracked(() => this.data.ref.set(r));
    });
  }

  protected lineTitle(l: DonationLine): string {
    const t = this.i18n.pick(l.titleAr, l.titleEn);
    return l.targetKind === 'category'
      ? `${$localize`:@@store.cart.general-gift:تبرع عام`} — ${t}`
      : t;
  }
}
