import type { PillTone } from './status-pill';

/** Order states (contract 15 §1.9) → label and pill tone. R5-Core sets only `pending_payment` and `cancelled`. */
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
