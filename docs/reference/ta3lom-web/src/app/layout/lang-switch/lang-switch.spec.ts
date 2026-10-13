import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { LangSwitch, localeHref } from './lang-switch';

/**
 * Session 1 owed test (08-testing-and-budgets.md): the language switch preserves the current
 * path. Each locale is a SEPARATE prerendered build served at /ar/ or /en/ (ADR-002), so
 * switching must land on the equivalent path under the other locale, never the home page.
 *
 * LangSwitch reads only `Router.url` (a plain string getter) — it never navigates — so the
 * component is exercised against a minimal fake Router rather than a real one with routes
 * registered, which would need an actual match for every path tested here.
 */
describe('LangSwitch', () => {
  function setup(locale: 'ar' | 'en', initialUrl: string) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: { url: initialUrl } },
        { provide: LOCALE_ID, useValue: locale },
      ],
    });
    const fixture = TestBed.createComponent(LangSwitch);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves a nested program-detail path when switching from ar to en', () => {
    expect(localeHref('/ar/programs/nujoom-al-uloom', 'en')).toBe('/en/programs/nujoom-al-uloom');
  });

  it('preserves a nested path when switching from en to ar', () => {
    expect(localeHref('/en/media/news/ziyarat-tafaqudiya', 'ar')).toBe('/ar/media/news/ziyarat-tafaqudiya');
  });

  it('lands on the other locale root, not a blank path, from the home page', () => {
    expect(localeHref('/ar', 'en')).toBe('/en/');
  });



  it('sets hreflang and lang to the target locale, and shows the target locale label', () => {
    const fixture = setup('ar', '/ar/contact');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.lang');
    expect(link.getAttribute('hreflang')).toBe('en');
    expect(link.getAttribute('lang')).toBe('en');
    expect(link.textContent?.trim()).toBe('EN');
  });
});
