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
import type { AdminOrderLine } from '../../../core/api/api.types';
import { westernDigits } from '../../../core/i18n/western-digits';
import { normalize, toHalalas } from '../../../core/money/money';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { toProblem } from '../../../core/api/problem';
import { StaffAuth } from '../../../core/auth/staff-auth';
import { valueOf } from '../../../core/http/resource-value';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { ToastService } from '../../../core/ui/toast.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { orderStatus, paymentStatus } from '../../../shared/ui/status-pill/status-labels';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { Requires } from '../ui/requires';
import { OpsData, upperRef } from './ops.data';

/** What a donation line went to: a general gift to a category, or the project (+ the option label). */
export function lineTitle(
  l: AdminOrderLine,
  pick: (ar: string, en: string | null) => string,
): string {
  const title = pick(l.titleAr, l.titleEn);
  if (l.targetKind === 'category')
    return `${$localize`:@@store.cart.general-gift:تبرع عام`} — ${title}`;
  return l.optionLabelAr ? `${title} — ${l.optionLabelAr}` : title;
}

/** A refund amount as the API expects it (two decimals) when it is within (0, refundable], else null. */
export function refundAmount(text: string, refundable: string): string | null {
  try {
    const v = normalize(westernDigits(text).trim());
    const h = toHalalas(v);
    return h > 0 && h <= toHalalas(refundable) ? v : null;
  } catch {
    return null;
  }
}

/** The refund dialog is ready: a valid amount, a reason, and the reference typed back (any case, outer spaces ignored). */
export function refundReady(amount: string | null, reason: string, typed: string, reference: string): boolean {
  return !!amount && reason.trim().length > 0 && typed.trim().toUpperCase() === reference;
}

/**
 * `/admin/orders/:ref` (contract 15 §2.8): donor, lines and status of one donation order; a pending order can be
 * cancelled (`staff:orders`, confirmed first). A 409 `order.cancel_not_allowed` is shown from its `code`, and the page
 * reloads the order to show its real state. R5-Payments (plan §4, §6 F5): the payments timeline (attempts, gateway
 * events, refunds, receipts) and the finance actions (`staff:finance`): refund an amount ≤ refundable with a typed
 * confirmation (the reference), accept or refund a payment in review, resend the receipt. Every action sends the
 * order's `version`; a 409 reloads the order. Idempotency-Keys live as long as their dialog.
 */
@Component({
  selector: 'ta-admin-order',
  imports: [RouterLink, Dialog, Money, ResourceState, StatusPill, Requires],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order.page.html',
  styleUrls: ['../admin-common.css', './order.page.css'],
})
export class AdminOrderPage {
  readonly ref = input.required<string>();

  protected readonly data = inject(OpsData);
  protected readonly auth = inject(StaffAuth);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly o = computed(() => valueOf(this.data.order));
  protected readonly notFound = computed(() => toProblem(this.data.order.error()).status === 404);
  protected readonly label = orderStatus;
  protected readonly payLabel = paymentStatus;
  protected readonly int = toInt;
  protected readonly canCancel = computed(
    () => this.o()?.status === 'pending_payment' && this.auth.can('staff:orders'),
  );
  protected readonly canFinance = computed(() => this.auth.can('staff:finance'));
  protected readonly inReview = computed(() => (this.o()?.payments ?? []).some((p) => p.status === 'review'));
  protected readonly canRefund = computed(() => this.o()?.status === 'paid' && toHalalas(this.o()?.refundable ?? '0') > 0);
  protected readonly hasReceipt = computed(() => (this.o()?.receipts ?? []).some((r) => r.series === 'DR'));

  /** One finance dialog at a time: 'refund' | 'accept' | 'review-refund' | 'resend'. */
  protected readonly dialog = signal<'refund' | 'accept' | 'review-refund' | 'resend' | null>(null);
  protected readonly dialogOpen = computed(() => this.dialog() !== null);
  protected readonly refundAmount = signal('');
  protected readonly refundReason = signal('');
  protected readonly typedRef = signal('');
  protected readonly financeError = signal<string | null>(null);
  private financeKey: string | null = null;

  /** The refund amount as a valid decimal string within (0, refundable], else null. */
  protected readonly refundValue = computed(() => refundAmount(this.refundAmount(), this.o()?.refundable ?? '0'));
  protected readonly refundReady = computed(() =>
    refundReady(this.refundValue(), this.refundReason(), this.typedRef(), this.o()?.reference ?? '-'),
  );

  protected readonly confirmOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ref = upperRef(this.ref());
      untracked(() => {
        this.data.orderRef.set(ref);
        this.data.order.reload();
        this.seo.set({ title: ref, description: '', path: `/admin/orders/${ref}`, noindex: true });
      });
    });
  }

  protected title(l: AdminOrderLine): string {
    return lineTitle(l, (ar, en) => this.i18n.pick(ar, en));
  }

  protected openFinance(kind: 'refund' | 'accept' | 'review-refund' | 'resend'): void {
    this.financeError.set(null);
    this.financeKey = crypto.randomUUID();
    this.typedRef.set('');
    this.refundReason.set('');
    this.refundAmount.set(kind === 'refund' ? (this.o()?.refundable ?? '') : '');
    this.dialog.set(kind);
  }

  protected closeFinance(): void {
    this.dialog.set(null);
    this.financeKey = null;
  }

  protected setDialogOpen(open: boolean): void {
    if (!open) this.closeFinance();
  }

  /** Runs the open finance action. A definite answer (2xx or 4xx) ends the dialog's key; a network error keeps it. */
  protected async runFinance(): Promise<void> {
    const o = this.o();
    const kind = this.dialog();
    if (!o || !kind || this.busy()) return;
    const version = Number(o.version);
    this.busy.set(true);
    this.financeError.set(null);
    try {
      const key = (this.financeKey ??= crypto.randomUUID());
      switch (kind) {
        case 'refund':
          await this.data.refund(o.reference, this.refundValue()!, this.refundReason().trim(), version, key);
          this.toast.show($localize`:@@store.admin.refund-done:تم الاسترداد.`, 'success');
          break;
        case 'accept':
          await this.data.acceptReview(o.reference, version);
          this.toast.show($localize`:@@store.admin.review-accepted:قُبلت الدفعة وأُصدر الإيصال.`, 'success');
          break;
        case 'review-refund':
          await this.data.refundReview(o.reference, version, this.refundReason().trim() || 'payment review', key);
          this.toast.show($localize`:@@store.admin.refund-done:تم الاسترداد.`, 'success');
          break;
        case 'resend':
          await this.data.resendReceipt(o.reference, key);
          this.toast.show($localize`:@@store.admin.receipt-resent:أُعيد إرسال الإيصال.`, 'success');
          break;
      }
      this.closeFinance();
    } catch (err) {
      const p = toProblem(err);
      if (p.status >= 400 && p.status < 500) this.financeKey = crypto.randomUUID();
      this.financeError.set(problemMessage(p));
      this.data.order.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected methodLabel(m: string): string {
    switch (m) {
      case 'mada':
        return 'mada';
      case 'creditcard':
        return $localize`:@@store.admin.method-card:بطاقة ائتمانية`;
      case 'applepay':
        return 'Apple Pay';
      case 'stcpay':
        return 'STC Pay';
      default:
        return '—';
    }
  }

  protected outcomeLabel(o: string | null): string {
    return o ?? '—';
  }

  protected async cancel(): Promise<void> {
    const o = this.o();
    if (!o || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.data.cancelOrder(o.reference);
      this.confirmOpen.set(false);
      this.toast.show($localize`:@@store.admin.order-cancelled:أُلغي الطلب.`, 'success');
    } catch (err) {
      this.error.set(problemMessage(toProblem(err)));
      this.data.order.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
