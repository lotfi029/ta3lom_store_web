import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { StatusPurchase } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StoreAuth } from '../../../core/auth/store-auth';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { Steps } from '../../../shared/ui/steps/steps';
import { ThanksData } from './thanks.data';

type View =
  | 'loading'
  | 'notFound'
  | 'pending'
  | 'slow'
  | 'paid'
  | 'failed'
  | 'review'
  | 'expired'
  | 'cancelled'
  | 'refunded';

/**
 * `/orders/:ref/thanks` (FR-S35, 10 §9): the order status from `GET /orders/{ref}/status`, polled until a terminal
 * state. Only the `t` query parameter is read (as a credential); a gateway's `status`/`id`/`message` parameters are
 * ignored (RUL-33). Today checkout ends here at "Awaiting payment"; the dev-only "Simulate payment" settles the order.
 */
@Component({
  selector: 'ta-thanks-page',
  imports: [RouterLink, Icon, Money, Steps],
  providers: [ThanksData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './thanks.page.html',
  styleUrl: './thanks.page.css',
})
export class ThanksPage {
  readonly ref = input.required<string>();
  readonly t = input<string | undefined>();

  protected readonly data = inject(ThanksData);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(StoreAuth);
  protected readonly simulating = signal(false);
  protected readonly devError = signal<string | null>(null);

  protected readonly order = this.data.value;
  protected readonly view = computed<View>(() => {
    const s = this.data.state();
    if (!s) {
      const err = this.data.status.error();
      if (err && !this.data.status.isLoading()) {
        const p = toProblem(err);
        if (p.status === 404 || p.status === 401) return 'notFound';
      }
      return 'loading';
    }
    switch (s) {
      case 'paid':
      case 'fulfilled':
        return 'paid';
      case 'payment_failed':
        return 'failed';
      case 'payment_review':
        return 'review';
      case 'expired':
        return 'expired';
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
      case 'partially_refunded':
        return 'refunded';
      default:
        return this.data.gaveUp() ? 'slow' : 'pending';
    }
  });
  protected readonly firstName = computed(
    () => (this.auth.customer()?.fullName ?? '').trim().split(/\s+/)[0] ?? '',
  );
  /** Purchases only (r4); a pre-r4 order's gift lines are not listed. */
  protected readonly purchases = computed(() => this.order()?.summary.purchases ?? []);
  protected readonly documents = computed(() =>
    (this.order()?.summary.documents ?? []).filter(
      (d) => d.kind === 'invoice' || d.kind === 'credit_note',
    ),
  );
  /** Announced once, when the order reaches a final state (the polling itself is silent). */
  protected readonly announcement = computed(() => (this.data.isTerminal() ? this.headline() : ''));
  protected readonly headline = computed(() => {
    switch (this.view()) {
      case 'paid':
        return this.firstName()
          ? $localize`:@@store.thanks.paid-name:شكرًا لك، ${this.firstName()}:name:`
          : $localize`:@@store.thanks.paid:شكرًا لك`;
      case 'failed':
        return $localize`:@@store.thanks.failed:لم يتم الدفع`;
      case 'review':
        return $localize`:@@store.thanks.review:نراجع عملية الدفع`;
      case 'expired':
        return $localize`:@@store.thanks.expired:انتهت مهلة هذا الطلب`;
      case 'cancelled':
        return $localize`:@@store.thanks.cancelled:أُلغي هذا الطلب`;
      case 'refunded':
        return $localize`:@@store.thanks.refunded:أُعيد مبلغ هذا الطلب`;
      case 'notFound':
        return $localize`:@@store.thanks.not-found:لم نجد هذا الطلب`;
      case 'slow':
        return $localize`:@@store.thanks.slow:يستغرق التأكيد وقتًا أطول من المعتاد`;
      case 'pending':
        return $localize`:@@store.thanks.pending:بانتظار الدفع`;
      default:
        return $localize`:@@store.thanks.loading:جارٍ تحميل طلبك…`;
    }
  });

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.thanks.title:حالة الطلب`,
      description: $localize`:@@store.thanks.seo-description:حالة طلبك من متجر جمعية التعلم الإلكتروني.`,
      path: '/orders',
      noindex: true,
    });
    effect(() => {
      this.data.ref.set(this.ref());
      this.data.statusToken.set(this.t() ?? null);
    });
  }

  protected title(p: StatusPurchase): string {
    return this.i18n.pick(p.titleAr, p.titleEn);
  }

  protected nextLink(p: StatusPurchase): string | null {
    switch (p.next) {
      case 'open_course':
        return '/account/courses';
      case 'download_book':
      case 'track_shipment':
        return '/account/books';
      default:
        return null;
    }
  }

  protected nextLabel(p: StatusPurchase): string {
    switch (p.next) {
      case 'open_course':
        return $localize`:@@store.thanks.next-course:ابدأ الدورة`;
      case 'download_book':
        return $localize`:@@store.thanks.next-download:نزّل الكتاب`;
      default:
        return $localize`:@@store.thanks.next-shipment:تتبّع الشحنة`;
    }
  }

  protected async simulate(): Promise<void> {
    if (this.simulating()) return;
    this.simulating.set(true);
    this.devError.set(null);
    try {
      await this.data.simulatePayment();
    } catch (e) {
      this.devError.set(problemMessage(toProblem(e)));
    } finally {
      this.simulating.set(false);
    }
  }
}
