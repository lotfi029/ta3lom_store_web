import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';
import { OrderData, OrderTokens, normalizeRef, pollDelay, statusRequest } from './order.data';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const STATUS = {
  reference: 'T3-26-000001',
  status: 'pending_payment',
  totalAmount: '120.00',
  lineCount: 2,
  createdAt: '2026-10-25T10:00:00+00:00',
  paymentDueAt: '2026-10-25T11:00:00+00:00',
};

describe('order status (D-W2, W-4, E-2, R3-2)', () => {
  it('upper-cases references (API-2)', () => {
    expect(normalizeRef(' t3-26-000001 ')).toBe('T3-26-000001');
  });

  it('R3-2: sends the token when known, the bearer alone when signed in, nothing with neither', () => {
    expect(statusRequest(API, 'R', true, 'tok')).toEqual({
      url: `${API}/orders/R/status`,
      params: { t: 'tok' },
    });
    expect(statusRequest(API, 'R', true, null)).toEqual({ url: `${API}/orders/R/status` });
    expect(statusRequest(API, 'R', false, 'tok')?.params).toEqual({ t: 'tok' });
    expect(statusRequest(API, 'R', false, null)).toBeUndefined();
  });

  it('E-2: remembers the token per reference in memory and session storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    new OrderTokens(storage).remember('T3-1', 'tok');
    expect(new OrderTokens(storage).get('T3-1')).toBe('tok');
    expect(new OrderTokens(null).get('T3-1')).toBeNull();
  });

  it('keeps the polling cadence for when payments are on', () => {
    expect(pollDelay(0)).toBe(2000);
    expect(pollDelay(61_000)).toBe(10_000);
    expect(pollDelay(11 * 60_000)).toBeNull();
  });

  describe('OrderData', () => {
    let data: OrderData;
    let http: HttpTestingController;
    let signedIn = false;

    beforeEach(() => {
      sessionStorage.clear();
      TestBed.configureTestingModule({
        providers: [
          OrderData,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: STORE_API_URL, useValue: API },
          { provide: StoreAuth, useValue: { isSignedIn: () => signedIn } },
        ],
      });
      data = TestBed.inject(OrderData);
      http = TestBed.inject(HttpTestingController);
    });

    it('D-W2: shows the pending order and never polls while payments are off', async () => {
      signedIn = false;
      data.open('t3-26-000001', 'tok');
      TestBed.tick();
      const req = http.expectOne((r) => r.url === `${API}/orders/T3-26-000001/status`);
      expect(req.request.params.get('t')).toBe('tok');
      req.flush(STATUS);
      await tick();
      TestBed.tick();
      expect(data.view()).toBe('ready');
      expect(data.paymentsEnabled).toBe(false);
      await new Promise((r) => setTimeout(r, 2100));
      TestBed.tick();
      http.expectNone(() => true);
    });

    it('R3-2: signed out with no token → "sign in to view", no request', () => {
      signedIn = false;
      data.open('T3-26-000001', null);
      TestBed.tick();
      http.expectNone(() => true);
      expect(data.view()).toBe('signIn');
    });

    it('R3-2: signed out, token rejected (404) → sign in, not the generic not-found', async () => {
      signedIn = false;
      data.open('T3-26-000001', 'stale');
      TestBed.tick();
      http
        .expectOne(() => true)
        .flush({ code: 'order.not_found' }, { status: 404, statusText: 'x' });
      await tick();
      TestBed.tick();
      expect(data.view()).toBe('signIn');
      expect(data.clientError()).toBe(true);
    });

    it('signed in, 404 → not found; the token from an earlier visit is reused', async () => {
      signedIn = true;
      data.open('T3-26-000002', 'tok2');
      TestBed.tick();
      http.expectOne(() => true).flush(STATUS);
      const again = TestBed.inject(OrderData);
      expect(again.token()).toBe('tok2');
      data.open('T3-26-000003', null);
      TestBed.tick();
      await tick();
      const req = http.expectOne((r) => r.url.includes('T3-26-000003'));
      expect(req.request.params.has('t')).toBe(false);
      req.flush({ code: 'order.not_found' }, { status: 404, statusText: 'x' });
      await tick();
      TestBed.tick();
      expect(data.view()).toBe('notFound');
    });
  });
});
