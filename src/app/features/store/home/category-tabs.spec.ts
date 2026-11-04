import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Category } from '../../../core/api/api.types';
import { CategoryTabs } from './category-tabs';

const cat = (slug: string, nameAr: string, nameEn: string | null): Category => ({
  id: `id-${slug}`,
  slug,
  nameAr,
  nameEn,
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  imageAltAr: null,
  imageAltEn: null,
  acceptsGeneralGifts: false,
  projectCount: 1,
});
const CATS = [cat('c-water', 'سقيا الماء', 'Water'), cat('c-relief', 'الإغاثة', null)];

function mount(active: string, locale = 'ar') {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
  const f = TestBed.createComponent(CategoryTabs);
  f.componentRef.setInput('categories', CATS);
  f.componentRef.setInput('active', active);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('CategoryTabs (Option C §3 row 3)', () => {
  it('renders "all" + one LINK per API category (no role=tab), in the API order', () => {
    const el = mount('');
    const tabs = [...el.querySelectorAll('nav a')];
    expect(tabs.map((a) => a.textContent?.trim())).toEqual([
      'كل المشاريع',
      'سقيا الماء',
      'الإغاثة',
    ]);
    expect(el.querySelector('[role=tab]')).toBeNull();
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('marks "all" current when no category is set', () => {
    const el = mount('');
    const current = el.querySelectorAll('[aria-current=page]');
    expect(current.length).toBe(1);
    expect(current[0].textContent?.trim()).toBe('كل المشاريع');
  });

  it('marks the active category current, and only it', () => {
    const el = mount('c-relief');
    const current = el.querySelectorAll('[aria-current=page]');
    expect(current.length).toBe(1);
    expect(current[0].textContent?.trim()).toBe('الإغاثة');
  });

  it('links set ?category and reset the page (q and sort kept by merge)', () => {
    const el = mount('');
    const hrefs = [...el.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(hrefs[0]).toBe('/');
    expect(hrefs[1]).toBe('/?category=c-water');
  });

  it('English falls back to Arabic for a category without an English name', () => {
    const el = mount('', 'en');
    const names = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(names[1]).toBe('Water');
    expect(names[2]).toBe('الإغاثة');
  });
});
