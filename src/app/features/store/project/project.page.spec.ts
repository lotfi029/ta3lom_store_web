import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { ProjectPage } from './project.page';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const DETAIL = {
  id: 'p1',
  slug: 'water-wells',
  status: 'published',
  titleAr: 'سقيا الماء',
  titleEn: 'Water wells',
  summaryAr: 'ملخص',
  summaryEn: null,
  bodyAr: '## القصة\n\nنص **مهم**.',
  bodyEn: null,
  coverUrl: null,
  coverAltAr: null,
  coverAltEn: null,
  badge: null,
  category: { id: 'c1', slug: 'relief', nameAr: 'الإغاثة', nameEn: 'Relief' },
  allowOpenAmount: true,
  minAmount: '10.00',
  options: [{ id: 'o1', labelAr: 'بئر', labelEn: 'Well', amount: '500.00' }],
  seoTitleAr: null,
  seoTitleEn: null,
  seoDescAr: null,
  seoDescEn: null,
  publishedAt: null,
};

describe('ProjectPage (W-M2)', () => {
  function mount(slug: string) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    const fixture = TestBed.createComponent(ProjectPage);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    TestBed.tick();
    return {
      fixture,
      http: TestBed.inject(HttpTestingController),
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('renders the project: one h1, the story as Markdown, the donate box with its options', async () => {
    const { fixture, http, el } = mount('water-wells');
    http.expectOne(`${API}/catalog/projects/water-wells`).flush(DETAIL);
    await tick();
    fixture.detectChanges();
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toContain('سقيا الماء');
    expect(el.querySelector('ta-markdown strong')?.textContent).toBe('مهم');
    expect(el.querySelectorAll('ta-donate-box input[type=radio]')).toHaveLength(2);
  });

  it('an old slug ({ redirectTo }) navigates to the current slug, replacing the history entry', async () => {
    const { fixture, http } = mount('old-wells');
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.expectOne(`${API}/catalog/projects/old-wells`).flush({ redirectTo: 'water-wells' });
    await tick();
    fixture.detectChanges();
    TestBed.tick();
    expect(nav).toHaveBeenCalledWith(['/p', 'water-wells'], { replaceUrl: true });
  });

  it('only an API 404 shows "not found", noindex', async () => {
    const { fixture, http, el } = mount('gone');
    http
      .expectOne(`${API}/catalog/projects/gone`)
      .flush({ code: 'project.not_found' }, { status: 404, statusText: 'x' });
    await tick();
    fixture.detectChanges();
    TestBed.tick();
    expect(el.querySelector('.gone h1')).not.toBeNull();
    expect(document.querySelector('meta[name=robots]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });

  it('a server error is not "not found": it offers a retry', async () => {
    const { fixture, http, el } = mount('flaky');
    http
      .expectOne(`${API}/catalog/projects/flaky`)
      .flush({ code: 'server.error' }, { status: 503, statusText: 'x' });
    await tick();
    fixture.detectChanges();
    expect(el.querySelector('.gone')).toBeNull();
    expect(el.querySelector('ta-resource-state')).not.toBeNull();
  });
});
