import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';
import {
  GIVE_UP_MS,
  TERMINAL,
  ThanksData,
  apiOrigin,
  pollDelay,
  statusRequest,
} from './thanks.data';

const API = 'https://store-api.test/v1';
const status = (s: string, over: object = {}) => ({
  reference: 'T3-1',
  status: s,
  grandTotal: '120.00',
  paidAt: null,
  paymentDueAt: '2026-10-14T10:00:00Z',
  payment: null,
  canRetry: false,
  cartRestored: false,
  summary: { purchases: [], gifts: [], dedications: null, documents: null },
  ...over,
});

describe('thanks polling (plan §6)', () => {
  it('polls every 2 s for 60 s, then every 10 s, and gives up at 10 minutes', () => {
    expect(pollDelay(0)).toBe(2000);
    expect(pollDelay(59_999)).toBe(2000);
    expect(pollDelay(60_000)).toBe(10_000);
    expect(pollDelay(GIVE_UP_MS - 1)).toBe(10_000);
    expect(pollDelay(GIVE_UP_MS)).toBeNull();
  });

  it('stops on terminal states', () => {
    for (const s of [
      'paid',
      'fulfilled',
      'payment_failed',
      'payment_review',
      'expired',
      'cancelled',
    ])
      expect(TERMINAL.has(s)).toBe(true);
    expect(TERMINAL.has('pending_payment')).toBe(false);
  });

  it('uses the bearer when signed in, else ?t=, and never the reference alone', () => {
    expect(statusRequest(API, 'T3-1', true, 'st')).toEqual({ url: `${API}/orders/T3-1/status` });
    expect(statusRequest(API, 'T3-1', false, 'st')).toEqual({
      url: `${API}/orders/T3-1/status`,
      params: { t: 'st' },
    });
    expect(statusRequest(API, 'T3-1', false, null)).toBeUndefined();
    expect(statusRequest(API, '', true, 'st')).toBeUndefined();
  });

  it('dev endpoints live at the API origin', () => {
    expect(apiOrigin(API)).toBe('https://store-api.test');
  });

  describe('ThanksData', () => {
    let http: HttpTestingController;
    let data: ThanksData;

    beforeEach(() => {
      vi.useFakeTimers();
      TestBed.configureTestingModule({
        providers: [
          ThanksData,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: STORE_API_URL, useValue: API },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      data = TestBed.inject(ThanksData);
    });
    afterEach(() => vi.useRealTimers());

    const flushTick = async () => {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(0);
      TestBed.tick();
    };

    it('polls with ?t= while pending and stops once paid; ignores anything but t', async () => {
      expect(TestBed.inject(StoreAuth).isSignedIn()).toBe(false);
      data.ref.set('T3-1');
      data.statusToken.set('st');
      await flushTick();
      const r1 = http.expectOne((r) => r.url === `${API}/orders/T3-1/status`);
      expect(r1.request.params.keys()).toEqual(['t']);
      r1.flush(status('pending_payment'));
      await flushTick();
      await vi.advanceTimersByTimeAsync(2000);
      await flushTick();
      http.expectOne((r) => r.url === `${API}/orders/T3-1/status`).flush(status('paid'));
      await flushTick();
      await vi.advanceTimersByTimeAsync(30_000);
      await flushTick();
      http.expectNone((r) => r.url === `${API}/orders/T3-1/status`);
      expect(data.state()).toBe('paid');
    });
  });
});
