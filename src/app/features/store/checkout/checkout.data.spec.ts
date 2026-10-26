import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { CheckoutData, canonicalJson, checkoutBody, type ContactInput } from './checkout.data';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const order = {
  reference: 'T3-26-000001',
  status: 'pending_payment',
  totalAmount: '120.00',
  statusToken: 'st_x',
  payment: null,
};
const contact: ContactInput = { fullName: ' Noura ', email: ' N@Example.com ', locale: 'en' };
const fail = (code: string, status: number, extra: Record<string, unknown> = {}) =>
  [
    { code, ...extra },
    { status, statusText: 'x' },
  ] as const;

describe('CheckoutData (contract 15 §1.10, W-1, U-3, R3-3)', () => {
  let data: CheckoutData;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CheckoutData,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    data = TestBed.inject(CheckoutData);
    data.inProgressDelays = [0, 0, 0];
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const next = async () => {
    await tick();
    await tick();
    return http.expectOne(`${API}/checkout`);
  };

  it('R3-3: normalises the body once (trim, lower-case e-mail, locale always) and sends that exact object', async () => {
    expect(checkoutBody(contact)).toEqual({
      fullName: 'Noura',
      email: 'n@example.com',
      locale: 'en',
    });
    expect(checkoutBody({ fullName: '  ', email: '', locale: 'ar' })).toEqual({
      fullName: null,
      email: null,
      locale: 'ar',
    });
    expect(canonicalJson({ b: 1, a: [2, { d: null, c: 'x' }] })).toBe(
      '{"a":[2,{"c":"x","d":null}],"b":1}',
    );
    const p = data.placeOrder(contact);
    const req = await next();
    expect(req.request.body).toEqual({ fullName: 'Noura', email: 'n@example.com', locale: 'en' });
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^.{8,64}$/);
    req.flush(order, { status: 201, statusText: 'Created' });
    expect(await p).toEqual({ kind: 'created', order });
  });

  it('W-1: keeps the key on 409 idempotency.in_progress (retries with the same key)', async () => {
    const p = data.placeOrder(contact);
    const first = await next();
    const key = first.request.headers.get('Idempotency-Key');
    first.flush(...fail('idempotency.in_progress', 409));
    const second = await next();
    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush(order, { status: 201, statusText: 'Created' });
    expect((await p).kind).toBe('created');
  });

  it('W-1: keeps the key on 429, 5xx and network errors; rotates after 201', async () => {
    for (const [err, status] of [
      ['http.rate_limited', 429],
      ['server.error', 500],
    ] as const) {
      const p = data.placeOrder(contact);
      (await next()).flush(...fail(err, status));
      await p;
    }
    const keyAfterFailures = data.attempt?.key;
    const p1 = data.placeOrder(contact);
    (await next()).error(new ProgressEvent('error'));
    await p1;
    expect(data.attempt?.key).toBe(keyAfterFailures);

    const p2 = data.placeOrder(contact);
    const ok = await next();
    expect(ok.request.headers.get('Idempotency-Key')).toBe(keyAfterFailures);
    ok.flush(order, { status: 201, statusText: 'Created' });
    await p2;
    expect(data.attempt).toBeNull();
  });

  it('W-1: rotates the key after a definite 4xx (lines_invalid) and returns the problems', async () => {
    const p = data.placeOrder(contact);
    const problems = [{ lineId: 'l1', code: 'cart.option_unavailable' }];
    (await next()).flush(...fail('checkout.lines_invalid', 422, { problems }));
    expect(await p).toEqual({ kind: 'linesInvalid', problems });
    expect(data.attempt).toBeNull();
  });

  it('U-3: a changed body gets a new key before it is sent', async () => {
    const p1 = data.placeOrder(contact);
    const r1 = await next();
    const k1 = r1.request.headers.get('Idempotency-Key');
    r1.flush(...fail('server.error', 503));
    await p1;
    const p2 = data.placeOrder({ ...contact, email: 'other@example.com' });
    const r2 = await next();
    expect(r2.request.headers.get('Idempotency-Key')).not.toBe(k1);
    r2.flush(order, { status: 201, statusText: 'Created' });
    await p2;
  });

  it('U-3: key_reused → new key, one retry → created', async () => {
    const p = data.placeOrder(contact);
    const r1 = await next();
    const k1 = r1.request.headers.get('Idempotency-Key');
    r1.flush(...fail('idempotency.key_reused', 422));
    const r2 = await next();
    expect(r2.request.headers.get('Idempotency-Key')).not.toBe(k1);
    r2.flush(order, { status: 201, statusText: 'Created' });
    expect((await p).kind).toBe('created');
  });

  const NOW = Date.parse('2026-10-26T12:00:00Z');
  const QUOTE = { lineCount: 2, totalAmount: '120.00' };
  const pending = (createdAt: string, totalAmount = '120.00', lineCount = 2) => ({
    items: [
      {
        reference: 'T3-26-000009',
        status: 'cancelled',
        totalAmount: '5.00',
        lineCount: 1,
        createdAt,
      },
      { reference: 'T3-26-000008', status: 'pending_payment', totalAmount, lineCount, createdAt },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  });
  const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
  const recover = async (body: ReturnType<typeof pending>) => {
    await tick();
    const list = http.expectOne((r) => r.url === `${API}/me/donations`);
    expect(list.request.params.get('page')).toBe('1');
    list.flush(body);
  };

  it('U-3: key_reused → retry says cart_empty → the earlier attempt placed it: newest pending donation', async () => {
    data.now = () => NOW;
    const p = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('idempotency.key_reused', 422));
    (await next()).flush(...fail('checkout.cart_empty', 409));
    await recover(pending(minutesAgo(2)));
    expect(await p).toEqual({ kind: 'recovered', reference: 'T3-26-000008' });
  });

  it('F-4: after an unknown outcome (503), a later cart_empty recovers the matching pending donation', async () => {
    data.now = () => NOW;
    const p1 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('server.error', 503));
    expect((await p1).kind).toBe('error');
    const p2 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('checkout.cart_empty', 409));
    await recover(pending(minutesAgo(1)));
    expect(await p2).toEqual({ kind: 'recovered', reference: 'T3-26-000008' });
  });

  it('R-2: a pending donation whose total differs from the last quote is not taken — cartEmpty + "my donations"', async () => {
    data.now = () => NOW;
    const p1 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('network.error', 0));
    await p1;
    const p2 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('checkout.cart_empty', 409));
    await recover(pending(minutesAgo(1), '95.00'));
    expect(await p2).toEqual({ kind: 'cartEmpty', checkMyDonations: true });
  });

  it('R-2: a matching pending donation older than 15 min (+5 min tolerance) is not taken', async () => {
    data.now = () => NOW;
    const p1 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('rate', 429));
    await p1;
    const p2 = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('checkout.cart_empty', 409));
    await recover(pending(minutesAgo(21)));
    expect(await p2).toEqual({ kind: 'cartEmpty', checkMyDonations: true });
  });

  it('R-2: within the tolerance (created 19 min ago, or 4 min "in the future") it is taken', async () => {
    for (const age of [19, -4]) {
      data.now = () => NOW;
      const p = data.placeOrder(contact, QUOTE);
      (await next()).flush(...fail('idempotency.key_reused', 422));
      (await next()).flush(...fail('checkout.cart_empty', 409));
      await recover(pending(minutesAgo(age)));
      expect(await p).toEqual({ kind: 'recovered', reference: 'T3-26-000008' });
    }
  });

  it('F-4: cart_empty with no earlier unknown outcome is just an empty cart — no donations lookup', async () => {
    const p = data.placeOrder(contact, QUOTE);
    (await next()).flush(...fail('checkout.cart_empty', 409));
    expect(await p).toEqual({ kind: 'cartEmpty' });
  });

  it('maps cart_empty and contact_required without a key_reused first', async () => {
    const p1 = data.placeOrder(contact);
    (await next()).flush(...fail('checkout.cart_empty', 409));
    expect(await p1).toEqual({ kind: 'cartEmpty' });
    const p2 = data.placeOrder(contact);
    (await next()).flush(...fail('checkout.contact_required', 422));
    expect(await p2).toEqual({ kind: 'contactRequired' });
  });

  it('gives up with inProgress after the configured retries', async () => {
    const p = data.placeOrder(contact);
    for (let i = 0; i < 4; i++) (await next()).flush(...fail('idempotency.in_progress', 409));
    expect(await p).toEqual({ kind: 'inProgress' });
    expect(data.attempt).not.toBeNull();
  });
});
