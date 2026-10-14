/**
 * Money is a decimal string with exactly two decimals (`"350.00"`, SAR implied — 11 §1.3, RUL-31).
 * Arithmetic happens in integer halalas (1 SAR = 100 halalas) and never through floating point: strings are parsed
 * digit by digit, results are formatted back to strings. The API returns every total the UI shows; these helpers serve
 * optimistic display (a line total before the server answers) and comparisons.
 */
export type Money = string;

const MONEY = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** `"350.00"` → 35000. Throws on anything that is not a plain decimal (no exponent, no grouping, ≤ 2 decimals). */
export function toHalalas(value: Money): number {
  const m = MONEY.exec(value.trim());
  if (!m) throw new Error(`money: not a decimal amount: "${value}"`);
  const [, sign, whole, frac = ''] = m;
  const halalas = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(halalas)) throw new Error(`money: amount out of range: "${value}"`);
  return sign && halalas !== 0 ? -halalas : halalas;
}

/** 35000 → `"350.00"`. */
export function fromHalalas(halalas: number): Money {
  if (!Number.isSafeInteger(halalas))
    throw new Error(`money: halalas must be an integer, got ${halalas}`);
  const sign = halalas < 0 ? '-' : '';
  const abs = Math.abs(halalas);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export const add = (a: Money, b: Money): Money => fromHalalas(toHalalas(a) + toHalalas(b));
export const subtract = (a: Money, b: Money): Money => fromHalalas(toHalalas(a) - toHalalas(b));
export const sum = (values: readonly Money[]): Money =>
  fromHalalas(values.reduce((t, v) => t + toHalalas(v), 0));

/** `times("350.00", 5)` → `"1750.00"`. Quantity must be a whole number. */
export function times(price: Money, quantity: number): Money {
  if (!Number.isInteger(quantity))
    throw new Error(`money: quantity must be an integer, got ${quantity}`);
  return fromHalalas(toHalalas(price) * quantity);
}

export const compare = (a: Money, b: Money): number => Math.sign(toHalalas(a) - toHalalas(b));
export const isZero = (a: Money | null | undefined): boolean => !a || toHalalas(a) === 0;
/** Normalises `"350"` / `"350.5"` → `"350.00"` / `"350.50"`. */
export const normalize = (a: Money): Money => fromHalalas(toHalalas(a));
