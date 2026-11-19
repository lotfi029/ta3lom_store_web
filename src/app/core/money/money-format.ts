import type { Locale } from '../i18n/i18n';
import { type Money, toHalalas } from './money';

/**
 * Display only: `"1750.00"` → `1,750.00` with Western digits in both locales (`ar-SA-u-nu-latn`, `en-SA`).
 * Whole riyals drop the decimals (`350` not `350.00`), as in the prototype's prices.
 *
 * Non-negative amounts (everything the storefront shows) are formatted from the decimal STRING by hand: both locales
 * give the same output (`,` every three digits, `.` before two decimals), and the first `Intl.NumberFormat` costs
 * ~35 ms at 4× CPU (ICU locale data) inside the home's hydration task — the CI Lighthouse TBT gate (DECISIONS: money
 * display without Intl). `money.spec.ts` checks the result is identical to Intl. Negative amounts (admin refunds)
 * still go through Intl, which adds a direction mark in Arabic; it receives the decimal string (exact, no float).
 */
const MONEY = /^(\d+)(?:\.(\d{1,2}))?$/;

function group(digits: string): string {
  const d = digits.replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+$)/g, ',');
}

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
  const whole = toHalalas(value) % 100 === 0; // also validates the amount
  const m = MONEY.exec(value.trim());
  if (m) {
    const [, int, frac = ''] = m;
    return whole ? group(int) : `${group(int)}.${frac.padEnd(2, '0')}`;
  }
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
