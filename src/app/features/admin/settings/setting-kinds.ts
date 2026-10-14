import { westernDigits } from '../../../core/i18n/western-digits';
import { normalize } from '../../../core/money/money';

export type SettingKind = 'boolean' | 'integer' | 'money' | 'text';

export interface SettingDef {
  key: string;
  kind: SettingKind;
  label: () => string;
  hint?: () => string;
  /** Inclusive range for integers. */
  min?: number;
  max?: number;
}

/**
 * The r4 settings (RUL §M, 11 §9.17) — an allowlist: keys the pre-r4 API still holds for giving are not shown.
 * Money is a decimal string, counts and percentages integers (never floats).
 */
export const SETTINGS: readonly SettingDef[] = [
  {
    key: 'vat_enabled',
    kind: 'boolean',
    label: () => $localize`:@@store.admin.set-vat-enabled:تفعيل ضريبة القيمة المضافة`,
  },
  {
    key: 'vat_rate',
    kind: 'integer',
    min: 0,
    max: 100,
    label: () => $localize`:@@store.admin.set-vat-rate:نسبة الضريبة (%)`,
  },
  {
    key: 'seller_vat_no',
    kind: 'text',
    label: () => $localize`:@@store.admin.set-seller-vat:الرقم الضريبي للبائع`,
  },
  {
    key: 'shipping_flat_fee',
    kind: 'money',
    label: () => $localize`:@@store.admin.set-shipping:رسوم الشحن للطلب (ر.س)`,
  },
  {
    key: 'cart_max_total',
    kind: 'money',
    label: () => $localize`:@@store.admin.set-cart-max:الحد الأعلى لقيمة السلة (ر.س)`,
  },
  {
    key: 'download_limit',
    kind: 'integer',
    min: 1,
    max: 100,
    label: () => $localize`:@@store.admin.set-download-limit:عدد التنزيلات لكل كتاب رقمي`,
  },
  {
    key: 'low_stock_default_threshold',
    kind: 'integer',
    min: 0,
    max: 100000,
    label: () => $localize`:@@store.admin.set-low-stock:حد التنبيه لانخفاض المخزون`,
  },
  {
    key: 'order_payment_timeout_min',
    kind: 'integer',
    min: 1,
    max: 10080,
    label: () => $localize`:@@store.admin.set-payment-timeout:مهلة الدفع (دقائق)`,
  },
  {
    key: 'refund_window_days',
    kind: 'integer',
    min: 0,
    max: 365,
    label: () => $localize`:@@store.admin.set-refund-days:مدة طلب الاسترجاع (أيام)`,
  },
  {
    key: 'refund_progress_max_pct',
    kind: 'integer',
    min: 0,
    max: 100,
    label: () =>
      $localize`:@@store.admin.set-refund-progress:أقصى تقدّم في الدورة يسمح بالاسترجاع (%)`,
  },
];

/** The value as an input shows it. */
export function toInput(kind: SettingKind, value: unknown): string | boolean {
  if (kind === 'boolean') return value === true;
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Input → the JSON value the API expects, or an error message. */
export function fromInput(
  def: SettingDef,
  raw: string | boolean,
): { value: unknown } | { error: string } {
  if (def.kind === 'boolean') return { value: raw === true };
  const text = westernDigits(String(raw)).trim();
  if (def.kind === 'text') return { value: text || null };
  if (def.kind === 'money') {
    try {
      const v = normalize(text);
      if (v.startsWith('-')) throw new Error('negative');
      return { value: v };
    } catch {
      return { error: $localize`:@@store.admin.money-invalid:أدخل مبلغًا مثل 25.00` };
    }
  }
  if (!/^\d+$/.test(text))
    return { error: $localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.` };
  const n = Number.parseInt(text, 10);
  if ((def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) {
    return {
      error: $localize`:@@store.admin.range-invalid:القيمة بين ${def.min ?? 0}:min: و${def.max ?? n}:max:.`,
    };
  }
  return { value: n };
}
