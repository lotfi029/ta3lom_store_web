import { DOCUMENT, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  function setup(locale = 'ar') {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    return { seo: TestBed.inject(SeoService), doc: TestBed.inject(DOCUMENT) };
  }

  it('puts the canonical and hreflang alternates on store.ta3lom.sa', () => {
    const { seo, doc } = setup('en');
    seo.set({ title: 'Smart study', description: 'd', path: '/p/smart-study' });
    expect(doc.title).toBe('Smart study — E-Learning Association Store');
    expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://store.ta3lom.sa/en/p/smart-study');
    expect(doc.querySelector('link[hreflang=ar]')?.getAttribute('href')).toBe('https://store.ta3lom.sa/ar/p/smart-study');
    expect(doc.querySelector('link[hreflang=x-default]')?.getAttribute('href')).toBe('https://store.ta3lom.sa/ar/p/smart-study');
    expect(doc.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('index, follow');
  });

  it('noindex pages drop canonical, alternates and JSON-LD', () => {
    const { seo, doc } = setup();
    seo.set({ title: 'x', description: 'd', path: '/p/x', jsonLd: { '@context': 'https://schema.org', '@type': 'Course' } });
    seo.set({ title: 'السلة', description: 'd', path: '/cart', noindex: true });
    expect(doc.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(doc.querySelector('link[rel=canonical]')).toBeNull();
    expect(doc.getElementById('ta-seo-json-ld')).toBeNull();
  });

  it('escapes < in JSON-LD', () => {
    const { seo, doc } = setup();
    seo.set({ description: 'd', path: '/', jsonLd: { '@context': 'https://schema.org', '@type': 'Thing', name: '</script><b>' } });
    expect(doc.getElementById('ta-seo-json-ld')?.textContent).not.toContain('</script>');
  });
});

describe('every routed page sets its SEO tags (non-negotiable #4)', () => {
  const pages = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? pages(p) : n.endsWith('.page.ts') ? [p] : [];
    });
  const root = join(process.cwd(), 'src/app/features');
  for (const file of pages(root)) {
    it(file.replace(root, 'features'), () => {
      expect(readFileSync(file, 'utf8')).toMatch(/\bseo\.set\(/);
    });
  }
});
