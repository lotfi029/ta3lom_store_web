import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';
import {
  OrderData,
  OrderTokens,
  normalizeRef,
  TERMINAL,
  orderPhase,
  pollDelay,
  statusRequest,
} from './order.data';

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
  it('shows references in their canonical upper case', () => {
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

  it('S-8: payment review is not final — asked every 60 s, with no time limit', () => {
    expect(TERMINAL.has('payment_review')).toBe(false);
    expect(pollDelay(0, 'review')).toBe(60_000);
    expect(pollDelay(2 * 60 * 60_000, 'review')).toBe(60_000);
    for (const s of ['paid', 'cancelled', 'expired', 'refunded']) expect(TERMINAL.has(s)).toBe(true);
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

    it('F5: a pending payment is polled; a paid order stops the polling', async () => {
      signedIn = false;
      data.open('t3-26-000001', 'tok');
      TestBed.tick();
      const req = http.expectOne((r) => r.url === `${API}/orders/T3-26-000001/status`);
      expect(req.request.params.get('t')).toBe('tok');
      req.flush({ ...STATUS, paymentStatus: 'initiated', canRetryPayment: false });
      await tick();
      TestBed.tick();
      expect(data.view()).toBe('ready');
      expect(data.phase()).toBe('pending');
      await new Promise((r) => setTimeout(r, 2100));
      TestBed.tick();
      http
        .expectOne(() => true)
        .flush({ ...STATUS, status: 'paid', paymentStatus: 'captured', receiptAvailable: true });
      await tick();
      TestBed.tick();
      expect(data.phase()).toBe('paid');
      await new Promise((r) => setTimeout(r, 2100));
      TestBed.tick();
      http.expectNone(() => true);
    });

    it('F5: a failed attempt (can retry) is not polled; pay again keeps its key until a definite answer', async () => {
      signedIn = false;
      data.open('T3-26-000004', 'tok4');
      TestBed.tick();
      http
        .expectOne(() => true)
        .flush({ ...STATUS, paymentStatus: 'failed', canRetryPayment: true });
      await tick();
      TestBed.tick();
      expect(data.phase()).toBe('retry');
      await new Promise((r) => setTimeout(r, 2100));
      TestBed.tick();
      http.expectNone(() => true);

      const first = data.payAgain();
      const r1 = http.expectOne(
        (r) => r.method === 'POST' && r.url === `${API}/orders/T3-26-000004/pay`,
      );
      expect(r1.request.params.get('t')).toBe('tok4');
      const key = r1.request.headers.get('Idempotency-Key');
      r1.error(new ProgressEvent('error')); // network: no definite answer
      expect((await first).kind).toBe('problem');
      http
        .match(() => true)
        .forEach((r) => r.flush({ ...STATUS, paymentStatus: 'failed', canRetryPayment: true }));
      const second = data.payAgain();
      const r2 = http.expectOne((r) => r.method === 'POST');
      expect(r2.request.headers.get('Idempotency-Key')).toBe(key);
      r2.flush({
        reference: 'T3-26-000004',
        payment: { redirectUrl: 'https://checkout.moyasar.com/invoices/x', expiresAt: null },
      });
      expect(await second).toEqual({
        kind: 'redirect',
        url: 'https://checkout.moyasar.com/invoices/x',
      });
    });

    it('F5: the receipt is fetched with the status token and its file name', async () => {
      signedIn = false;
      data.open('T3-26-000005', 'tok5');
      TestBed.tick();
      http.expectOne(() => true).flush({ ...STATUS, status: 'paid', receiptAvailable: true });
      const pending = data.receipt('dr');
      const req = http.expectOne((r) => r.url === `${API}/orders/T3-26-000005/receipt`);
      expect(req.request.params.get('t')).toBe('tok5');
      req.flush(new Blob(['%PDF-']), {
        headers: { 'Content-Disposition': 'attachment; filename=DR-2026-000001.pdf' },
      });
      const out = await pending;
      expect('blob' in out && out.fileName).toBe('DR-2026-000001.pdf');
    });

    it.each([
      [{ status: 'paid' }, 'paid'],
      [{ status: 'payment_review' }, 'review'],
      [{ status: 'expired' }, 'expired'],
      [{ status: 'refunded' }, 'refunded'],
      [{ status: 'cancelled' }, 'cancelled'],
      [{ status: 'pending_payment', canRetryPayment: true }, 'retry'],
      [{ status: 'pending_payment', canRetryPayment: false, paymentStatus: 'initiated' }, 'pending'],
      // S-6: no attempt at all (gateway down at checkout) → pay again, not "checking" forever.
      [{ status: 'pending_payment', canRetryPayment: false, paymentStatus: null }, 'retry'],
      [{ status: 'pending_payment', canRetryPayment: false }, 'retry'],
    ] as const)('phase of %o is %s', (o, phase) => {
      expect(orderPhase(o)).toBe(phase);
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
