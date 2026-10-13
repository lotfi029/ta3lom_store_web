import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Cart, CartLine } from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { CartStore } from './cart-store';
import { CartSummary } from './cart-summary';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));

const line = (id: string, over: Partial<CartLine> = {}): CartLine =>
  ({ id, productId: `p-${id}`, slug: id, type: 'book', kind: 'buy', mode: 'units', titleAr: id, titleEn: null, bookFormat: { id: `f-${id}`, kind: 'print' }, quantity: 1, maxQuantity: 20, unitPrice: '65.00', amount: '65.00', unitLabelAr: null, unitLabelEn: null, seatEquivalent: null, intent: null, dedication: null, issues: [], ...over }) as CartLine;
const cart = (lines: CartLine[], shipping = '25.00'): Cart =>
  ({ id: 'c', isGuest: true, purchases: lines, gifts: [], notices: [], expiresAt: null, summary: { purchasesTotal: lines.reduce((t, l) => t + Number(l.amount), 0).toFixed(2), vatIncluded: '0.00', shippingTotal: lines.length ? shipping : '0.00', giftsTotal: '0.00', grandTotal: '0', lineCount: lines.length, requiresShipping: lines.length > 0, hasGifts: false } }) as unknown as Cart;

describe('CartStore (plan §6)', () => {
  let store: CartStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: STORE_API_URL, useValue: API }] });
    store = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);
    store.load();
    TestBed.tick();
    http.expectOne(`${API}/cart`).flush(cart([line('a')]));
    await tick();
    TestBed.tick();
  });

  it('adds optimistically, then the server answer replaces the view and bumps the badge', async () => {
    const summary = TestBed.inject(CartSummary);
    const done = store.add({ productId: 'p-new', bookFormatId: null, quantity: 1, preview: { slug: 'new', type: 'course', titleAr: 'جديد', titleEn: null, unitPrice: '120.00', formatKind: null } });
    await tick();
    expect(store.lines().map((l) => l.slug)).toEqual(['a', 'new']);
    const req = http.expectOne(`${API}/cart/lines`);
    expect(req.request.body).toEqual({ kind: 'buy', mode: 'units', amount: null, intent: null, dedication: null, productId: 'p-new', bookFormatId: null, quantity: 1 });
    req.flush(cart([line('a'), line('srv', { slug: 'new', type: 'course', bookFormat: null })]), { status: 201, statusText: 'Created' });
    expect(await done).toBe(true);
    expect(store.lines().map((l) => l.id)).toEqual(['a', 'srv']);
    expect(summary.count()).toBe(2);
    expect(summary.bumps()).toBe(1);
  });

  it('merges the same product and format into one line (RUL-14)', async () => {
    void store.add({ productId: 'p-a', bookFormatId: 'f-a', quantity: 2 });
    await tick();
    expect(store.lines()[0].quantity).toBe(3);
    expect(store.lines()[0].amount).toBe('195.00');
    http.expectOne(`${API}/cart/lines`).flush(cart([line('a', { quantity: 3, amount: '195.00' })]), { status: 201, statusText: 'Created' });
  });

  it('rolls back and keeps the problem when the server refuses', async () => {
    const done = store.remove('a');
    await tick();
    expect(store.lines()).toEqual([]);
    http.expectOne(`${API}/cart/lines/a`).flush({ code: 'cart.line_not_found' }, { status: 404, statusText: 'x' });
    expect(await done).toBe(false);
    expect(store.lines().map((l) => l.id)).toEqual(['a']);
    expect(store.lastProblem()?.code).toBe('cart.line_not_found');
  });

  it('runs mutations in order, so a slow answer never overwrites a newer one', async () => {
    const first = store.setQuantity('a', 2);
    const second = store.setQuantity('a', 5);
    await tick();
    const r1 = http.expectOne(`${API}/cart/lines/a`);
    expect(r1.request.body).toEqual({ quantity: 2 });
    http.expectNone(`${API}/cart/lines/a`); // the second waits for the first
    r1.flush(cart([line('a', { quantity: 2, amount: '130.00' })]));
    await first;
    await tick();
    const r2 = http.expectOne(`${API}/cart/lines/a`);
    expect(r2.request.body).toEqual({ quantity: 5 });
    r2.flush(cart([line('a', { quantity: 5, amount: '325.00' })]));
    await second;
    expect(store.lines()[0].quantity).toBe(5);
  });

  it('caps quantity at the line maximum (print 20)', async () => {
    void store.setQuantity('a', 99);
    await tick();
    expect(http.expectOne(`${API}/cart/lines/a`).request.body).toEqual({ quantity: 20 });
  });

  it('flags lines the checkout quote repriced and switches the totals to the quote (RUL-15)', async () => {
    const done = store.checkPrices();
    const req = http.expectOne(`${API}/checkout/quote`);
    expect(req.request.method).toBe('POST');
    req.flush({ lines: [{ lineId: 'a', status: 'changed', code: null, previousUnitPrice: '65.00', unitPrice: '70.00', amount: '70.00', vatAmount: '0.00' }], purchasesTotal: '70.00', shippingTotal: '25.00', giftsTotal: '0.00', vatTotal: '0.00', grandTotal: '95.00', priceChanged: true, requiresShipping: true, hasGifts: false, valid: true, cartIssues: [] });
    await done;
    expect(store.priceChanged()).toEqual(['a']);
    expect(store.repriced('a')?.unitPrice).toBe('70.00');
    expect(store.totals().grand).toBe('95.00');
  });

  it('drops the quote when the cart changes, and never quotes an empty cart', async () => {
    void store.checkPrices();
    http.expectOne(`${API}/checkout/quote`).flush({ lines: [{ lineId: 'a', status: 'changed', code: null, previousUnitPrice: '65.00', unitPrice: '70.00', amount: '70.00', vatAmount: '0.00' }], purchasesTotal: '70.00', shippingTotal: '25.00', giftsTotal: '0.00', vatTotal: '0.00', grandTotal: '95.00', priceChanged: true, requiresShipping: true, hasGifts: false, valid: true, cartIssues: [] });
    await tick();
    void store.remove('a');
    await tick();
    http.expectOne(`${API}/cart/lines/a`).flush(cart([]));
    await tick();
    expect(store.priceChanged()).toEqual([]);
    await store.checkPrices();
    http.expectNone(`${API}/checkout/quote`);
  });

  it('estimates totals in halalas during an edit (shipping only with print)', async () => {
    void store.setQuantity('a', 3);
    await tick();
    expect(store.totals().purchases).toBe('195.00');
    expect(store.totals().grand).toBe('220.00');
    http.expectOne(`${API}/cart/lines/a`).flush(cart([line('a', { quantity: 3, amount: '195.00' })]));
  });
});
