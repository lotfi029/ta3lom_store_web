import type { Locale } from '../i18n/i18n';
import { type Money, toHalalas } from './money';

/**
 * Display only: `"1750.00"` → `1,750.00` with Western digits in both locales (`ar-SA-u-nu-latn`, `en-SA`).
 * Intl.NumberFormat receives the decimal STRING (exact, ES2023 Intl.NumberFormat v3) — no float is ever made.
 * Whole riyals drop the decimals (`350` not `350.00`), as in the prototype's prices.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale, fractionDigits: 0 | 2): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, f);
  }
  return f;
}

export function formatAmount(value: Money, locale: Locale): string {
  const whole = toHalalas(value) % 100 === 0;
  // `format` accepts a decimal string exactly; the cast only satisfies older lib typings.
  return formatter(locale, whole ? 0 : 2).format(value as unknown as number);
}

/** The currency label shown next to an amount (prototype `.cur`). */
export function currencyLabel(locale: Locale): string {
  return locale === 'ar' ? 'ر.س' : 'SAR';
}

export function formatMoney(value: Money, locale: Locale): string {
  return locale === 'ar'
    ? `${formatAmount(value, locale)} ${currencyLabel(locale)}`
    : `${currencyLabel(locale)} ${formatAmount(value, locale)}`;
}
