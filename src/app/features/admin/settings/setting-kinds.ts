import { normalizeSaudiMobile, toE164, westernDigits } from '../../../core/i18n/western-digits';
import { normalize, toHalalas } from '../../../core/money/money';

export type SettingKind = 'integer' | 'money' | 'money-list' | 'text' | 'mobile';

export interface SettingDef {
  key: string;
  kind: SettingKind;
  label: () => string;
  hint?: () => string;
  /** Inclusive range for integers, item count for money lists, length for text. */
  min?: number;
  max?: number;
}

const MONEY_MAX = '100000.00';

/**
 * The R5 settings allow-list (contract 15 §2.8 `PUT /v1/admin/settings/{key}`). Money is a decimal string, counts are
 * integers (never floats). Cross-key rules (min gift ≤ line maximum ≤ cart maximum, presets ≥ min gift) are checked by
 * the API against the committed values; its 422 `setting.invalid_value` is shown on the field.
 */
export const SETTINGS: readonly SettingDef[] = [
  {
    key: 'min_gift_amount',
    kind: 'money',
    label: () => $localize`:@@store.admin.set-min-gift:أقل مبلغ للتبرع (ر.س)`,
    hint: () =>
      $localize`:@@store.admin.set-min-gift-hint:للمبلغ المفتوح والتبرع للتصنيف، ما لم يحدّد المشروع حدًا أعلى.`,
  },
  {
    key: 'max_line_amount',
    kind: 'money',
    label: () => $localize`:@@store.admin.set-max-line:أعلى مبلغ للتبرع الواحد (ر.س)`,
  },
  {
    key: 'cart_max_total',
    kind: 'money',
    label: () => $localize`:@@store.admin.set-cart-max:الحد الأعلى لمجموع السلة (ر.س)`,
  },
  {
    key: 'cart_max_lines',
    kind: 'integer',
    min: 1,
    max: 50,
    label: () => $localize`:@@store.admin.set-cart-lines:أكبر عدد من التبرعات في السلة`,
  },
  {
    key: 'payment_window_minutes',
    kind: 'integer',
    min: 5,
    max: 1440,
    label: () => $localize`:@@store.admin.set-payment-window:مهلة الدفع بعد تسجيل التبرع (دقائق)`,
  },
  {
    key: 'amount_presets',
    kind: 'money-list',
    min: 1,
    max: 6,
    label: () => $localize`:@@store.admin.set-presets:المبالغ المقترحة (ر.س، مفصولة بفواصل)`,
    hint: () =>
      $localize`:@@store.admin.set-presets-hint:من 1 إلى 6 مبالغ، كل منها لا يقل عن أقل مبلغ للتبرع.`,
  },
  {
    key: 'site_name_ar',
    kind: 'text',
    min: 1,
    max: 120,
    label: () => $localize`:@@store.admin.set-site-name-ar:اسم المتجر بالعربية`,
  },
  {
    key: 'site_name_en',
    kind: 'text',
    min: 1,
    max: 120,
    label: () => $localize`:@@store.admin.set-site-name-en:اسم المتجر بالإنجليزية`,
  },
  {
    key: 'support_mobile',
    kind: 'mobile',
    label: () => $localize`:@@store.admin.set-support-mobile:جوال الدعم`,
    hint: () => $localize`:@@store.admin.set-support-mobile-hint:اتركه فارغًا لإخفائه.`,
  },
];

/** The value as an input shows it. */
export function toInput(kind: SettingKind, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (kind === 'money-list' && Array.isArray(value)) return value.map(String).join(', ');
  if (kind === 'mobile' && typeof value === 'string' && value.startsWith('+966'))
    return `0${value.slice(4)}`;
  return String(value);
}

function money(text: string): string | null {
  try {
    const v = normalize(text);
    return toHalalas(v) > 0 && toHalalas(v) <= toHalalas(MONEY_MAX) ? v : null;
  } catch {
    return null;
  }
}

/** Input → the JSON value the API expects, or an error message. Arabic-Indic digits and ٫ are accepted. */
export function fromInput(def: SettingDef, raw: string): { value: unknown } | { error: string } {
  const text = westernDigits(raw).trim();
  switch (def.kind) {
    case 'text': {
      if (!text) return { value: null };
      return text.length > (def.max ?? 120)
        ? { error: $localize`:@@store.admin.text-too-long:النص أطول من المسموح.` }
        : { value: text };
    }
    case 'mobile': {
      if (!text) return { value: null };
      const m = normalizeSaudiMobile(text);
      return m
        ? { value: toE164(m) }
        : {
            error: $localize`:@@store.error.otp-mobile-invalid:أدخل رقم جوال سعودي صحيحًا يبدأ بـ 05.`,
          };
    }
    case 'money': {
      const v = money(text);
      return v
        ? { value: v }
        : {
            error: $localize`:@@store.admin.money-invalid-range:أدخل مبلغًا أكبر من صفر حتى 100000.00`,
          };
    }
    case 'money-list': {
      const items = text.split(/[,،\s]+/).filter(Boolean);
      const values = items.map(money);
      if (
        items.length < (def.min ?? 1) ||
        items.length > (def.max ?? 6) ||
        values.some((v) => v === null)
      )
        return {
          error: $localize`:@@store.admin.presets-invalid:أدخل من 1 إلى 6 مبالغ صحيحة مفصولة بفواصل.`,
        };
      return { value: values };
    }
    case 'integer': {
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
  }
}
