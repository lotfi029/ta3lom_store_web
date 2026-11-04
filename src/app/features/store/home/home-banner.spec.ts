import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProjectCard } from '../../../core/api/api.types';
import { HomeBanner, bannerSlides } from './home-banner';

const card = (id: string, badge: string | null): ProjectCard => ({
  id,
  slug: `p-${id}`,
  titleAr: `مشروع ${id}`,
  titleEn: null,
  summaryAr: `ملخص ${id}`,
  summaryEn: null,
  coverUrl: null,
  coverAltAr: null,
  coverAltEn: null,
  badge,
  categorySlug: 'c-relief',
  allowOpenAmount: true,
  minAmount: '10.00',
  fromAmount: null,
  options: [],
});

function mount(featured: ProjectCard[]) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'ar' },
    ],
  });
  const f = TestBed.createComponent(HomeBanner);
  f.componentRef.setInput('featured', featured);
  f.detectChanges();
  return f;
}

describe('home banner (Option C §2, §3 row 4)', () => {
  it('picks every urgent featured card; else the first featured; else none', () => {
    expect(
      bannerSlides([card('a', 'new'), card('b', 'urgent'), card('c', 'urgent')]).map((c) => c.id),
    ).toEqual(['b', 'c']);
    expect(bannerSlides([card('a', 'new'), card('b', null)]).map((c) => c.id)).toEqual(['a']);
    expect(bannerSlides([])).toEqual([]);
  });

  it('one slide: the title is the h1, the CTA goes to /p/{slug}, no controls', () => {
    const el = mount([card('a', null)]).nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('مشروع a');
    expect(el.querySelector('a.cta')?.getAttribute('href')).toBe('/p/p-a');
    expect(el.querySelector('.ctrl')).toBeNull();
  });

  it('no featured → renders nothing', () => {
    const el = mount([]).nativeElement as HTMLElement;
    expect(el.querySelector('section')).toBeNull();
    expect(el.querySelector('h1')).toBeNull();
  });

  it('several urgent: labelled prev/next + dots, buttons move (wrapping), announced politely, no auto-rotate', async () => {
    const f = mount([card('a', 'urgent'), card('b', 'urgent'), card('c', 'urgent')]);
    const el = f.nativeElement as HTMLElement;
    const h1 = () => el.querySelector('h1')?.textContent?.trim();
    expect(el.querySelectorAll('.dot')).toHaveLength(3);
    expect(el.querySelector('.prev')?.getAttribute('aria-label')).toBeTruthy();
    expect(el.querySelector('.dot[aria-current=true]')?.getAttribute('aria-label')).toContain('1');
    await new Promise((r) => setTimeout(r, 50));
    f.detectChanges();
    expect(h1()).toBe('مشروع a'); // never moves on its own
    (el.querySelector('.next') as HTMLButtonElement).click();
    f.detectChanges();
    expect(h1()).toBe('مشروع b');
    expect(el.querySelector('[aria-live=polite]')?.textContent).toContain('مشروع b');
    (el.querySelector('.prev') as HTMLButtonElement).click();
    (el.querySelector('.prev') as HTMLButtonElement).click();
    f.detectChanges();
    expect(h1()).toBe('مشروع c');
    (el.querySelectorAll('.dot')[0] as HTMLButtonElement).click();
    f.detectChanges();
    expect(h1()).toBe('مشروع a');
  });

  it('L-11: when the featured list shrinks, the index resets and aria-current points at a real slide', () => {
    const f = mount([card('a', 'urgent'), card('b', 'urgent'), card('c', 'urgent')]);
    const el = f.nativeElement as HTMLElement;
    (el.querySelector('.prev') as HTMLButtonElement).click(); // → c (index 2)
    f.detectChanges();
    f.componentRef.setInput('featured', [card('a', 'urgent'), card('b', 'urgent')]);
    f.detectChanges();
    const current = el.querySelectorAll('.dot[aria-current=true]');
    expect(current).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('مشروع a');
  });
});
