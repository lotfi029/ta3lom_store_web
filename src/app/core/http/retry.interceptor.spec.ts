import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { STORE_API_URL } from '../api/store-api-url';
import { RETRYABLE, retryDelay, retryInterceptor } from './retry.interceptor';

const API = 'https://store-api.test/v1';

function setup(platform = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptors([retryInterceptor])),
      provideHttpClientTesting(),
      { provide: STORE_API_URL, useValue: API },
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return { http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
}

describe('retryInterceptor (owner M-7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('jitter is 300–800 ms', () => {
    expect(retryDelay(() => 0)).toBe(300);
    expect(retryDelay(() => 0.999999)).toBe(800);
    expect([...RETRYABLE].sort()).toEqual([0, 502, 503, 504]);
  });

  for (const status of [0, 502, 503, 504])
    it(`a GET that fails with ${status} is retried once, after the jitter`, async () => {
      const { http, ctl } = setup();
      const p = firstValueFrom(http.get(`${API}/catalog/home`));
      ctl.expectOne(`${API}/catalog/home`).flush(null, { status, statusText: 'x' });
      ctl.expectNone(`${API}/catalog/home`);
      await vi.advanceTimersByTimeAsync(800);
      ctl.expectOne(`${API}/catalog/home`).flush({ ok: true });
      await expect(p).resolves.toEqual({ ok: true });
      ctl.verify();
    });

  it('retries only once', async () => {
    const { http, ctl } = setup();
    const p = firstValueFrom(http.get(`${API}/catalog/home`)).catch((e) => e.status);
    ctl.expectOne(`${API}/catalog/home`).flush(null, { status: 503, statusText: 'x' });
    await vi.advanceTimersByTimeAsync(800);
    ctl.expectOne(`${API}/catalog/home`).flush(null, { status: 503, statusText: 'x' });
    await expect(p).resolves.toBe(503);
    ctl.verify();
  });

  for (const status of [429, 400, 404, 500])
    it(`never on ${status}`, async () => {
      const { http, ctl } = setup();
      const p = firstValueFrom(http.get(`${API}/catalog/home`)).catch((e) => e.status);
      ctl.expectOne(`${API}/catalog/home`).flush(null, { status, statusText: 'x' });
      await expect(p).resolves.toBe(status);
      await vi.advanceTimersByTimeAsync(1000);
      ctl.verify();
    });

  it('never for writes, /auth/refresh, other origins, or during the prerender', async () => {
    let { http, ctl } = setup();
    const post = firstValueFrom(http.post(`${API}/cart/lines`, {})).catch((e) => e.status);
    ctl.expectOne(`${API}/cart/lines`).flush(null, { status: 503, statusText: 'x' });
    const refresh = firstValueFrom(http.get(`${API}/auth/refresh`)).catch((e) => e.status);
    ctl.expectOne(`${API}/auth/refresh`).flush(null, { status: 503, statusText: 'x' });
    const other = firstValueFrom(http.get('https://elsewhere.test/x')).catch((e) => e.status);
    ctl.expectOne('https://elsewhere.test/x').flush(null, { status: 503, statusText: 'x' });
    await expect(Promise.all([post, refresh, other])).resolves.toEqual([503, 503, 503]);
    await vi.advanceTimersByTimeAsync(1000);
    ctl.verify();
    TestBed.resetTestingModule();
    ({ http, ctl } = setup('server'));
    const server = firstValueFrom(http.get(`${API}/catalog/home`)).catch((e) => e.status);
    ctl.expectOne(`${API}/catalog/home`).flush(null, { status: 503, statusText: 'x' });
    await expect(server).resolves.toBe(503);
    await vi.advanceTimersByTimeAsync(1000);
    ctl.verify();
  });
});
