/**
 * Arabic-Indic (٠–٩) and Extended Arabic-Indic / Persian (۰–۹) digits → 0–9, plus the Arabic
 * thousands and decimal separators (٬ ٫). Non-negotiable #2: numerals are Western everywhere — and
 * an editor on an Arabic keyboard types the other ones by default. Everything else, including the
 * Arabic percent sign ٪, is left as typed.
 */
export function westernDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
}
