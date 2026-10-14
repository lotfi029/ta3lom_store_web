import { Injectable, LOCALE_ID, inject } from '@angular/core';

export type Locale = 'ar' | 'en';
export type Direction = 'ltr' | 'rtl';

/** English falls back to Arabic — never an empty string when an English column is null (non-negotiable #3). */
export function pick(locale: Locale, ar: string, en?: string | null): string {
  return locale === 'en' ? en?.trim() || ar : ar;
}

export const RIYADH = 'Asia/Riyadh';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly localeId = inject(LOCALE_ID);

  /** Fixed per build (`localize: true` compiles one bundle per locale). */
  readonly locale: Locale = this.localeId.startsWith('en') ? 'en' : 'ar';
  readonly direction: Direction = this.locale === 'ar' ? 'rtl' : 'ltr';
  readonly otherLocale: Locale = this.locale === 'ar' ? 'en' : 'ar';

  pick(ar: string, en?: string | null): string {
    return pick(this.locale, ar, en);
  }

  /** Gregorian calendar, Western digits, Riyadh time (plan §6 "Format"). */
  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const value = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(`${this.locale}-SA-u-ca-gregory-nu-latn`, {
      timeZone: RIYADH,
      ...(options ?? { year: 'numeric', month: 'long', day: 'numeric' }),
    }).format(value);
  }

  formatDateTime(date: Date | string): string {
    return this.formatDate(date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA').format(value);
  }
}
