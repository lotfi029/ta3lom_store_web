import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { HomeData } from './home.data';

const API = 'https://store-api.test/v1';
const card = (slug: string) => ({
  id: slug,
  slug,
  titleAr: slug,
  titleEn: null,
  summaryAr: null,
  summaryEn: null,
  coverUrl: null,
  coverAltAr: null,
  coverAltEn: null,
  badge: null,
  categorySlug: 'c',
  allowOpenAmount: true,
  minAmount: '10.00',
  fromAmount: null,
  options: [],
});

describe('HomeData (U-2)', () => {
  it('requests the default listing with a stable URL and keeps the API order as is', async () => {
    TestBed.configureTestingModule({
      providers: [
        HomeData,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    const data = TestBed.inject(HomeData);
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    const req = http.expectOne((r) => r.url === `${API}/catalog/projects`);
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    // The API's default order (sort, published_at DESC, id) — deliberately not alphabetical.
    req.flush({
      items: [card('zeta'), card('alpha'), card('mid')],
      total: 3,
      page: 1,
      pageSize: 12,
    });
    http.expectOne(`${API}/catalog/categories`).flush([]);
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
    expect(data.items().map((c) => c.slug)).toEqual(['zeta', 'alpha', 'mid']);
    expect(data.pages()).toBe(1);
  });
});
