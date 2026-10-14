import type { PillTone } from './status-pill';

/** Order states (RUL-29) → label and pill tone. */
export function orderStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'pending_payment':
      return { label: $localize`:@@store.account.order-pending:بانتظار الدفع`, tone: 'warning' };
    case 'paid':
      return { label: $localize`:@@store.account.order-paid:مدفوع`, tone: 'success' };
    case 'fulfilled':
      return { label: $localize`:@@store.account.order-fulfilled:مكتمل`, tone: 'success' };
    case 'payment_failed':
      return { label: $localize`:@@store.account.order-failed:لم يتم الدفع`, tone: 'danger' };
    case 'payment_review':
      return { label: $localize`:@@store.account.order-review:قيد المراجعة`, tone: 'warning' };
    case 'expired':
      return { label: $localize`:@@store.account.order-expired:منتهي المهلة`, tone: 'neutral' };
    case 'cancelled':
      return { label: $localize`:@@store.account.order-cancelled:ملغى`, tone: 'neutral' };
    case 'refunded':
      return { label: $localize`:@@store.account.order-refunded:مسترد`, tone: 'neutral' };
    case 'partially_refunded':
      return {
        label: $localize`:@@store.account.order-partially-refunded:مسترد جزئيًا`,
        tone: 'neutral',
      };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Shipment states (RUL-40). */
export function shipmentStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'preparing':
      return { label: $localize`:@@store.account.ship-preparing:قيد التجهيز`, tone: 'warning' };
    case 'shipped':
      return { label: $localize`:@@store.account.ship-shipped:تم الشحن`, tone: 'info' };
    case 'delivered':
      return { label: $localize`:@@store.account.ship-delivered:تم التسليم`, tone: 'success' };
    case 'returned':
      return { label: $localize`:@@store.account.ship-returned:مُرتجع`, tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** Document kinds (RUL-59; r4: invoices and credit notes). */
export function documentKind(kind: string): string {
  switch (kind) {
    case 'credit_note':
      return $localize`:@@store.account.doc-credit-note:إشعار دائن`;
    case 'cancellation':
      return $localize`:@@store.account.doc-cancellation:إشعار إلغاء`;
    default:
      return $localize`:@@store.thanks.invoice:فاتورة`;
  }
}
