import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { I18nService } from '../core/i18n';
import { buildNavGroups } from './nav-data';

/** CR-02 requests 2, 3, 4 and 8 — the order and names the client asked for, pinned. */
describe('buildNavGroups', () => {
  function groups(locale: 'ar' | 'en') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: LOCALE_ID, useValue: locale }],
    });
    return buildNavGroups(TestBed.inject(I18nService));
  }
  const group = (locale: 'ar' | 'en', id: string) => groups(locale).find((g) => g.id === id)!;

  it('lists the About pages in the requested order', () => {
    expect(group('ar', 'nav-about').links!.map((l) => l.label)).toEqual([
      'الهوية والرسالة',
      'الهيكل الإداري',
      'التراخيص',
      'المستفيدون',
      'المواقع المرتبطة',
    ]);
  });

  it('names the governance group الحوكمة and opens it with اللوائح والسياسات', () => {
    const g = group('ar', 'nav-structure');
    expect(g.label).toBe('الحوكمة');
    expect(g.links![0]).toEqual({ label: 'اللوائح والسياسات', path: '/about/governance' });
  });

  it('carries the six new documents pages and no beneficiaries in the governance group', () => {
    const paths = group('ar', 'nav-structure').links!.map((l) => l.path);
    expect(paths).toEqual([
      '/about/governance',
      '/about/reports',
      '/about/assembly',
      '/about/strategic-plan',
      '/about/operational-plan',
      '/about/project-reports',
      '/about/committees',
      '/about/committee-decisions',
      '/about/investor-decisions',
    ]);
    expect(paths).not.toContain('/about/beneficiaries');
  });

  it('uses the English labels in the English build', () => {
    expect(group('en', 'nav-structure').label).toBe('Governance');
    expect(group('en', 'nav-structure').links![0].label).toBe('Bylaws & policies');
  });
});
