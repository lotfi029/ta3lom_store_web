import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { I18nService, pick } from './i18n';
import { normalizeSaudiMobile, toE164, westernDigits } from './western-digits';

describe('pick()', () => {
  it('falls back to Arabic when English is null or blank', () => {
    expect(pick('en', 'عربي', null)).toBe('عربي');
    expect(pick('en', 'عربي', '  ')).toBe('عربي');
    expect(pick('en', 'عربي', 'English')).toBe('English');
    expect(pick('ar', 'عربي', 'English')).toBe('عربي');
  });
});

describe('Saudi mobile normalisation (plan §6 checkout form)', () => {
  it('accepts 05…, +9665…, 009665… and Arabic-Indic digits', () => {
    expect(normalizeSaudiMobile('0551234567')).toBe('0551234567');
    expect(normalizeSaudiMobile('+966 55 123 4567')).toBe('0551234567');
    expect(normalizeSaudiMobile('00966551234567')).toBe('0551234567');
    expect(normalizeSaudiMobile('551234567')).toBe('0551234567');
    expect(normalizeSaudiMobile('٠٥٥١٢٣٤٥٦٧')).toBe('0551234567');
    expect(normalizeSaudiMobile('۰۵۵۱۲۳۴۵۶۷')).toBe('0551234567');
  });

  it('rejects non-mobiles', () => {
    for (const bad of ['0112345678', '05512345', '+971551234567', 'abc'])
      expect(normalizeSaudiMobile(bad)).toBeNull();
  });

  it('converts to E.164 and Western digits', () => {
    expect(toE164('0551234567')).toBe('+966551234567');
    expect(westernDigits('٣٥٠٫٥')).toBe('350.5');
  });
});

describe('I18nService', () => {
  it('formats Gregorian dates in Riyadh time with Western digits', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'ar' }] });
    const i18n = TestBed.inject(I18nService);
    expect(i18n.direction).toBe('rtl');
    const text = i18n.formatDate('2026-10-13T22:30:00Z');
    expect(text).toContain('14'); // 01:30 on the 14th in Riyadh
    expect(text).toContain('2026');
    expect(text).not.toMatch(/[٠-٩]/);
  });

  it('is LTR in English', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en' }] });
    expect(TestBed.inject(I18nService).direction).toBe('ltr');
  });
});
