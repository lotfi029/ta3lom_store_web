/**
 * Arabic-Indic (٠–٩) and Extended Arabic-Indic (۰–۹) digits → 0–9, plus ٬ ٫ separators. Visitors on an Arabic keyboard
 * type these by default; numerals are Western everywhere (non-negotiable #2).
 */
export function westernDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
}

/**
 * Saudi mobile as typed (`05…`, `5…`, `+9665…`, `009665…`, Arabic-Indic digits, spaces) → `05XXXXXXXX`, or null when
 * it is not a Saudi mobile. The API accepts `05…` (11 §1.3) and answers in E.164.
 */
export function normalizeSaudiMobile(input: string): string | null {
  const digits = westernDigits(input).replace(/[\s\-()]/g, '');
  const m = /^(?:\+?966|00966|0)?(5\d{8})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/** `05XXXXXXXX` → `+9665XXXXXXXX`. */
export const toE164 = (mobile05: string): string => `+966${mobile05.slice(1)}`;
