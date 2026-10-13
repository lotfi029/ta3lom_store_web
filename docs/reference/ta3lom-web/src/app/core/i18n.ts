import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { getLocaleDirection } from '@angular/common';

export type Locale = 'ar' | 'en';
export type Direction = 'ltr' | 'rtl';

/**
 * English falls back to Arabic — never render an empty string when an English column is
 * null. See CLAUDE.md non-negotiable #3.
 */
export function pick(locale: Locale, ar: string, en?: string | null): string {
  return locale === 'en' ? en?.trim() || ar : ar;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly localeId = inject(LOCALE_ID);

  /** Fixed per build (localize:true compiles one bundle per locale) — never runtime-negotiated. */
  readonly locale: Locale = this.localeId.startsWith('en') ? 'en' : 'ar';
  readonly direction: Direction = getLocaleDirection(this.localeId) === 'rtl' ? 'rtl' : 'ltr';

  pick(ar: string, en?: string | null): string {
    return pick(this.locale, ar, en);
  }

  /** Gregorian calendar, Western (0123) numerals — never Arabic-Indic digits. */
  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const value = typeof date === 'string' ? new Date(date) : date;
    const tag = `${this.locale}-u-ca-gregory-nu-latn`;
    return new Intl.DateTimeFormat(tag, options ?? { year: 'numeric', month: 'long', day: 'numeric' }).format(value);
  }
}
