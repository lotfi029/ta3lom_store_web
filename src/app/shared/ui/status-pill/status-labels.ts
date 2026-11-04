import type { PillTone } from './status-pill';

/** Order states (contract 15 §1.9, R5-Payments) → label and pill tone. */
export function orderStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'pending_payment':
      return { label: $localize`:@@store.order.status-pending:بانتظار الدفع`, tone: 'warning' };
    case 'paid':
      return { label: $localize`:@@store.order.status-paid:مدفوع`, tone: 'success' };
    case 'payment_review':
      return { label: $localize`:@@store.order.status-review:قيد المراجعة`, tone: 'warning' };
    case 'expired':
      return { label: $localize`:@@store.order.status-expired:منتهي المهلة`, tone: 'neutral' };
    case 'cancelled':
      return { label: $localize`:@@store.order.status-cancelled:ملغى`, tone: 'neutral' };
    case 'refunded':
      return { label: $localize`:@@store.order.status-refunded:مسترد`, tone: 'info' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Payment attempt states (R5-Payments, admin timeline). */
export function paymentStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'initiated':
      return {
        label: $localize`:@@store.admin.payment-initiated:بانتظار البوابة`,
        tone: 'warning',
      };
    case 'captured':
      return { label: $localize`:@@store.admin.payment-captured:مدفوعة`, tone: 'success' };
    case 'failed':
      return { label: $localize`:@@store.admin.payment-failed:فشلت`, tone: 'danger' };
    case 'cancelled':
      return { label: $localize`:@@store.admin.payment-cancelled:أُلغيت`, tone: 'neutral' };
    case 'review':
      return { label: $localize`:@@store.admin.payment-review:قيد المراجعة`, tone: 'warning' };
    case 'refunded':
      return { label: $localize`:@@store.admin.payment-refunded:مستردة`, tone: 'info' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Project states (D-07) → label and pill tone. */
export function projectStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'published':
      return { label: $localize`:@@store.admin.status-published:منشور`, tone: 'success' };
    case 'archived':
      return { label: $localize`:@@store.admin.status-archived:مؤرشف`, tone: 'neutral' };
    default:
      return { label: $localize`:@@store.admin.status-draft:مسودة`, tone: 'warning' };
  }
}

/** Donor states (contract 15 §1.9). */
export function customerStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'active':
      return { label: $localize`:@@store.admin.donor-active:نشط`, tone: 'success' };
    case 'blocked':
      return { label: $localize`:@@store.admin.donor-blocked:موقوف`, tone: 'danger' };
    case 'anonymised':
      return { label: $localize`:@@store.admin.donor-anonymised:محذوف (مجهّل)`, tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Why a payment or an order is in payment review (review 04 W-4: incl. the new external_refund, voided_after_capture). */
export function reviewReason(reason: string | null | undefined): string {
  switch (reason) {
    case 'amount_mismatch':
      return $localize`:@@store.admin.review-amount-mismatch:مبلغ مختلف عن مبلغ التبرع`;
    case 'late_capture':
      return $localize`:@@store.admin.review-late-capture:دفعة وصلت بعد انتهاء المهلة`;
    case 'double_payment':
      return $localize`:@@store.admin.review-double-payment:دفعة مكررة`;
    case 'external_refund':
      return $localize`:@@store.admin.review-external-refund:استرداد من خارج المتجر قبل اعتماد الدفعة`;
    case 'voided_after_capture':
      return $localize`:@@store.admin.review-voided:ألغت البوابة دفعة سبق تحصيلها`;
    default:
      return reason ?? '—';
  }
}

/** Refund states (review 04 P-3: `requested` = waiting for the gateway's confirmation). */
export function refundStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'requested':
      return { label: $localize`:@@store.admin.refund-requested:بانتظار تأكيد البوابة`, tone: 'warning' };
    case 'succeeded':
      return { label: $localize`:@@store.admin.refund-succeeded:تم`, tone: 'success' };
    case 'failed':
      return { label: $localize`:@@store.admin.refund-failed:لم يتم`, tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Who made a refund (review 04 A-2): finance in the store, or someone on the gateway's dashboard. */
export function refundSource(source: string | null | undefined): string {
  return source === 'gateway'
    ? $localize`:@@store.admin.refund-source-gateway:من لوحة بوابة الدفع`
    : $localize`:@@store.admin.refund-source-store:من المتجر`;
}

