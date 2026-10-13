import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { CheckoutData } from './checkout.data';
import { emptyCheckout } from './checkout.form';

const API = 'https://store-api.test/v1';
const order = {
  orderId: 'o',
  reference: 'T3-26-000001',
  status: 'pending_payment',
  grandTotal: '120.00',
  paymentDueAt: '2026-10-14T10:00:00Z',
  statusToken: 'st_x',
  payment: {
    paymentId: null,
    provider: null,
    method: 'mada',
    redirectUrl: null,
    sdkPayload: null,
    expiresAt: '2026-10-14T10:00:00Z',
  },
};

describe('CheckoutData (plan §6: idempotency, price change)', () => {
  let data: CheckoutData;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CheckoutData,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
        { provide: LOCALE_ID, useValue: 'en' },
      ],
    });
    data = TestBed.inject(CheckoutData);
    http = TestBed.inject(HttpTestingController);
  });

  const body = () =>
    data.buildRequest(
      { ...emptyCheckout(), name: ' Noura ', email: 'n@example.com', acceptTerms: true },
      false,
      '120.00',
    );

  it('builds the request: acceptTerms true, expected total, locale, no address without print', () => {
    expect(body()).toEqual({
      contact: { fullName: 'Noura', email: 'n@example.com' },
      isAnonymous: false,
      shippingAddressId: null,
      shippingAddress: null,
      saveAddress: false,
      paymentMethod: 'mada',
      acceptTerms: true,
      expectedGrandTotal: '120.00',
      locale: 'en',
    });
  });

  it('sends a saved address id, or the inline address, only with a print line', () => {
    const saved = data.buildRequest({ ...emptyCheckout(), savedId: 'a1' }, true, '1.00');
    expect(saved.shippingAddressId).toBe('a1');
    expect(saved.shippingAddress).toBeNull();
    const inline = data.buildRequest(
      {
        ...emptyCheckout(),
        address: {
          ...emptyCheckout().address,
          recipientName: 'N',
          recipientMobile: '0551234567',
          city: 'Riyadh',
          shortAddress: 'rrrd2929',
        },
      },
      true,
      '1.00',
    );
    expect(inline.shippingAddress?.shortAddress).toBe('RRRD2929');
    expect(inline.saveAddress).toBe(true);
  });

  it('keeps the Idempotency-Key after a network error or 5xx (a retry cannot create a second order)', async () => {
    const key = data.idempotencyKey();
    const first = data.placeOrder(body());
    const r1 = http.expectOne(`${API}/checkout`);
    expect(r1.request.headers.get('Idempotency-Key')).toBe(key);
    r1.flush({ code: 'server.error' }, { status: 503, statusText: 'x' });
    expect((await first).kind).toBe('error');
    const second = data.placeOrder(body());
    const r2 = http.expectOne(`${API}/checkout`);
    expect(r2.request.headers.get('Idempotency-Key')).toBe(key);
    r2.flush(order, { status: 201, statusText: 'Created' });
    expect((await second).kind).toBe('created');
  });

  it('price changed: returns the new quote and uses a new Idempotency-Key next time', async () => {
    const key = data.idempotencyKey();
    const p = data.placeOrder(body());
    http
      .expectOne(`${API}/checkout`)
      .flush(
        { code: 'checkout.price_changed', quote: { grandTotal: '130.00' } },
        { status: 409, statusText: 'Conflict' },
      );
    const outcome = await p;
    expect(outcome).toEqual({ kind: 'priceChanged', quote: { grandTotal: '130.00' } });
    expect(data.idempotencyKey()).not.toBe(key);
  });

  it('maps lines_invalid and gateway_unavailable', async () => {
    const a = data.placeOrder(body());
    http
      .expectOne(`${API}/checkout`)
      .flush(
        { code: 'checkout.lines_invalid', lines: [{ lineId: 'l1', code: 'cart.out_of_stock' }] },
        { status: 422, statusText: 'x' },
      );
    expect(await a).toEqual({
      kind: 'linesInvalid',
      lines: [{ lineId: 'l1', code: 'cart.out_of_stock' }],
    });
    const b = data.placeOrder(body());
    http
      .expectOne(`${API}/checkout`)
      .flush(
        { code: 'checkout.gateway_unavailable', reference: 'T3-1', statusToken: 'st' },
        { status: 503, statusText: 'x' },
      );
    expect(await b).toEqual({ kind: 'gatewayDown', reference: 'T3-1', statusToken: 'st' });
  });
});
