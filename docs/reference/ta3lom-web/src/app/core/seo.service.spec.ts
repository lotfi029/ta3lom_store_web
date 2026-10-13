import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { SeoService } from './seo.service';

/**
 * CLAUDE.md non-negotiable #4 / docs/architecture/08-testing-and-budgets.md: every route calls
 * SeoService.set(), and it must set title, description, canonical, Open Graph, Twitter card and
 * JSON-LD — this closes audit findings F-14 and F-15.
 */
describe('SeoService', () => {
  function setup(locale: 'ar' | 'en') {
    TestBed.configureTestingModule({
      providers: [SeoService, Meta, Title, { provide: LOCALE_ID, useValue: locale }],
    });
    return TestBed.inject(SeoService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"], meta[property^="og:"], meta[name^="twitter:"], meta[name="description"], #ta-seo-json-ld').forEach((el) => el.remove());
  });

  it('sets title, description, canonical, Open Graph, Twitter card and hreflang alternates', () => {
    const seo = setup('ar');
    const titleService = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);

    seo.set({
      title: 'برنامج نجوم العلوم',
      description: 'وصف قصير للبرنامج',
      canonical: 'https://ta3lom.sa/ar/programs/nujoom-al-uloom',
      image: 'https://ta3lom.sa/media/abc/file',
    });

    expect(titleService.getTitle()).toBe('برنامج نجوم العلوم');
    expect(meta.getTag('name="description"')?.content).toBe('وصف قصير للبرنامج');

    expect(meta.getTag('property="og:type"')?.content).toBe('website');
    expect(meta.getTag('property="og:site_name"')?.content).toBe('جمعية التعلم الإلكتروني');
    expect(meta.getTag('property="og:title"')?.content).toBe('برنامج نجوم العلوم');
    expect(meta.getTag('property="og:description"')?.content).toBe('وصف قصير للبرنامج');
    expect(meta.getTag('property="og:url"')?.content).toBe('https://ta3lom.sa/ar/programs/nujoom-al-uloom');
    expect(meta.getTag('property="og:locale"')?.content).toBe('ar_SA');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://ta3lom.sa/media/abc/file');

    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
    expect(meta.getTag('name="twitter:title"')?.content).toBe('برنامج نجوم العلوم');
    expect(meta.getTag('name="twitter:image"')?.content).toBe('https://ta3lom.sa/media/abc/file');

    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://ta3lom.sa/ar/programs/nujoom-al-uloom');
    const enAlt = document.head.querySelector('link[rel="alternate"][hreflang="en"]');
    expect(enAlt?.getAttribute('href')).toBe('https://ta3lom.sa/en/programs/nujoom-al-uloom');
    const xDefault = document.head.querySelector('link[rel="alternate"][hreflang="x-default"]');
    expect(xDefault?.getAttribute('href')).toBe('https://ta3lom.sa/ar/programs/nujoom-al-uloom');
  });

  it('uses en_US for the English locale', () => {
    const seo = setup('en');
    seo.set({ title: 't', description: 'd', canonical: 'https://ta3lom.sa/en/programs' });
    expect(TestBed.inject(Meta).getTag('property="og:locale"')?.content).toBe('en_US');
  });

  it('omits og:image/twitter:image and falls back to a summary card when no image is given', () => {
    const seo = setup('ar');
    seo.set({ title: 't', description: 'd', canonical: 'https://ta3lom.sa/ar/' });
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:image"')).toBeNull();
    expect(meta.getTag('name="twitter:image"')).toBeNull();
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
  });

  it('writes JSON-LD as a script tag and removes it on the next call without one', () => {
    const seo = setup('ar');
    seo.set({
      title: 't',
      description: 'd',
      canonical: 'https://ta3lom.sa/ar/',
      jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: 'جمعية التعلم الإلكتروني' },
    });
    const script = document.getElementById('ta-seo-json-ld');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent ?? '{}')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'جمعية التعلم الإلكتروني',
    });

    seo.set({ title: 't2', description: 'd2', canonical: 'https://ta3lom.sa/ar/' });
    expect(document.getElementById('ta-seo-json-ld')).toBeNull();
  });

  it('setAdminTitle sets the title and a noindex robots tag, with no Open Graph or canonical', () => {
    const seo = setup('ar');
    seo.setAdminTitle('نظرة عامة — لوحة التحكم');

    expect(TestBed.inject(Title).getTitle()).toBe('نظرة عامة — لوحة التحكم');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(TestBed.inject(Meta).getTag('property="og:title"')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
