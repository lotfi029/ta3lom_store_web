import { westernDigits } from '../i18n/western-digits';
import { type Money, compare, normalize } from './money';

/** The API's money input (contract 15 §1.3): 1–10 digits, optional 1–2 decimals, after digit normalisation. */
const AMOUNT = /^[0-9]{1,10}(\.[0-9]{1,2})?$/;

export type AmountCheck =
  | { ok: true; amount: Money }
  | { ok: false; reason: 'empty' | 'format' | 'zero' | 'min' | 'max'; limit?: Money };

/**
 * What a donor typed → a normalised amount (`"50.00"`) or why it is not one. Arabic-Indic and Eastern Arabic digits
 * and the Arabic decimal separator `٫` are accepted (as the API does); group separators, signs and exponents are not.
 * `min` and `max` come from `/catalog/config` and the project's `minAmount` (never hard-coded, W-5).
 */
export function checkAmount(raw: string, min: Money | null, max: Money | null): AmountCheck {
  const text = westernDigits(raw).replace(/\s+/g, '');
  if (!text) return { ok: false, reason: 'empty' };
  if (!AMOUNT.test(text)) return { ok: false, reason: 'format' };
  const amount = normalize(text);
  if (compare(amount, '0.00') <= 0) return { ok: false, reason: 'zero' };
  if (min && compare(amount, min) < 0) return { ok: false, reason: 'min', limit: normalize(min) };
  if (max && compare(amount, max) > 0) return { ok: false, reason: 'max', limit: normalize(max) };
  return { ok: true, amount };
}

/** The text an amount field shows after blur: Western digits, the decimals the donor typed (no forced ".00"). */
export function displayAmount(raw: string): string {
  return westernDigits(raw).replace(/\s+/g, '');
}
