import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import type { Category } from '../../core/api/api.types';
import { STORE_API_URL } from '../../core/api/store-api-url';
import { QuickDonate } from '../../core/ui/quick-donate.service';
import { PublicLayout } from './public-layout';

const API = 'https://store-api.test/v1';
const cat = (slug: string, gifts: boolean): Category => ({
  id: slug,
  slug,
  nameAr: slug,
  nameEn: null,
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  imageAltAr: null,
  imageAltEn: null,
  acceptsGeneralGifts: gifts,
  projectCount: 0,
});

@Component({ template: '' })
class Blank {}

/** Pending auth/cart requests keep the app unstable on purpose: tick instead of whenStable. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
  }
}

async function mount(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([
        { path: '', component: Blank },
        { path: 'p/:slug', component: Blank },
        { path: 'cart', component: Blank },
      ]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: STORE_API_URL, useValue: API },
      { provide: LOCALE_ID, useValue: 'ar' },
    ],
  });
  const f = TestBed.createComponent(PublicLayout);
  await TestBed.inject(Router).navigateByUrl(url);
  await settle();
  const http = TestBed.inject(HttpTestingController);
  const el = f.nativeElement as HTMLElement;
  const buttons = () => ({
    header: el.querySelectorAll('ta-header button.quick').length,
    floating: el.querySelectorAll('button.side-quick').length,
  });
  const answer = async (list: Category[] | 'error') => {
    const req = http.expectOne((r) => r.url === `${API}/catalog/categories`);
    if (list === 'error') req.flush(null, { status: 503, statusText: 'x' });
    else req.flush(list);
    await settle();
  };
  return { f, buttons, answer, quick: TestBed.inject(QuickDonate) };
}

describe('quick-donate entry points (review 06 F-5)', () => {
  for (const url of ['/p/water', '/cart']) {
    it(`${url}: hidden while the count is unknown, shown once a gift category is known`, async () => {
      const { buttons, answer, quick } = await mount(url);
      expect(quick.giftCategoryCount()).toBeNull();
      expect(buttons()).toEqual({ header: 0, floating: 0 });
      await answer([cat('fund', true), cat('wells', false)]);
      expect(quick.giftCategoryCount()).toBe(1);
      expect(buttons().header).toBeGreaterThan(0);
      if (url.startsWith('/p/')) expect(buttons().floating).toBe(1); // floating only while browsing
      else expect(buttons().floating).toBe(0);
    });
  }

  it('no category takes general gifts → header and floating buttons stay hidden', async () => {
    const { buttons, answer } = await mount('/p/water');
    await answer([cat('wells', false)]);
    expect(buttons()).toEqual({ header: 0, floating: 0 });
  });

  it('the read fails → stays hidden (never shown on an unknown count)', async () => {
    const { buttons, answer, quick } = await mount('/p/water');
    await answer('error');
    expect(quick.giftCategoryCount()).toBeNull();
    expect(buttons()).toEqual({ header: 0, floating: 0 });
  });
});
