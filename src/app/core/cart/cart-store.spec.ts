import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Cart, CartLine } from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { CartStore, lineBody, mergeOrAppend } from './cart-store';
import { CartSummary } from './cart-summary';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const CONFIG = {
  minGiftAmount: '10.00',
  maxLineAmount: '100000.00',
  cartMaxLines: 50,
  cartMaxTotal: '100000.00',
  maxQuantity: 5,
  amountPresets: ['50.00', '100.00'],
};

const line = (id: string, over: Partial<CartLine> = {}): CartLine => ({
  id,
  targetKind: 'project',
  projectId: `p-${id}`,
  projectSlug: id,
  categoryId: null,
  categorySlug: null,
  optionId: `o-${id}`,
  titleAr: id,
  titleEn: null,
  optionLabelAr: 'كفالة يوم',
  optionLabelEn: null,
  quantity: 1,
  unitAmount: '50.00',
  amount: '50.00',
  problems: [],
  ...over,
});
const cart = (lines: CartLine[]): Cart => ({
  lines,
  lineCount: lines.length,
  totalAmount: lines.reduce((t, l) => t + Math.round(Number(l.amount) * 100), 0) / 100 + '.00',
  problems: [],
});
const preview = { titleAr: 'سقيا', titleEn: 'Water', slug: 'water' };

describe('CartStore (contract 15 §2.3)', () => {
  let store: CartStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    store = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.match(`${API}/catalog/config`).forEach((r) => r.flush(CONFIG));
    store.load();
    TestBed.tick();
    http.expectOne(`${API}/cart`).flush(cart([line('a')]));
    await tick();
    TestBed.tick();
  });

  it('sends exactly one body shape per line kind', () => {
    const none = {
      projectId: null,
      optionId: null,
      categoryId: null,
      amount: null,
      quantity: null,
    };
    expect(
      lineBody({
        kind: 'option',
        projectId: 'p',
        optionId: 'o',
        quantity: 2,
        unitAmount: '5.00',
        preview,
      }),
    ).toEqual({ ...none, projectId: 'p', optionId: 'o', quantity: 2 });
    expect(lineBody({ kind: 'project', projectId: 'p', amount: '75', preview })).toEqual({
      ...none,
      projectId: 'p',
      amount: '75.00',
    });
    expect(lineBody({ kind: 'category', categoryId: 'c', amount: '100.5', preview })).toEqual({
      ...none,
      categoryId: 'c',
      amount: '100.50',
    });
  });

  it('adds optimistically, then the server answer replaces the view and bumps the badge', async () => {
    const summary = TestBed.inject(CartSummary);
    const done = store.add({ kind: 'project', projectId: 'p-new', amount: '75', preview });
    await tick();
    expect(store.lines().length).toBe(2);
    expect(store.total()).toBe('125.00');
    const req = http.expectOne(`${API}/cart/lines`);
    expect(req.request.method).toBe('POST');
    req.flush(
      cart([line('a'), line('b', { optionId: null, unitAmount: '75.00', amount: '75.00' })]),
    );
    expect(await done).toBe(true);
    expect(store.lines().map((l) => l.id)).toEqual(['a', 'b']);
    expect(summary.count()).toBe(2);
    expect(summary.bumps()).toBe(1);
  });

  it('merges the same option into its line, capped at the configured maximum quantity (W-5)', () => {
    const merged = mergeOrAppend(
      [line('a', { quantity: 4 })],
      {
        kind: 'option',
        projectId: 'p-a',
        optionId: 'o-a',
        quantity: 3,
        unitAmount: '50.00',
        preview,
      },
      5,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
    expect(merged[0].amount).toBe('250.00');
    expect(store.maxQuantity()).toBe(5);
  });

  it('caps a quantity edit at the configured maximum, not a hard-coded one (W-5)', async () => {
    const done = store.setQuantity('a', 40);
    await tick();
    const req = http.expectOne(`${API}/cart/lines/a`);
    expect(req.request.body).toEqual({ quantity: 5 });
    req.flush(cart([line('a', { quantity: 5, amount: '250.00' })]));
    expect(await done).toBe(true);
  });

  it('rolls back a failed edit and keeps the problem with its extension values', async () => {
    const done = store.setAmount('a', '5');
    await tick();
    const req = http.expectOne(`${API}/cart/lines/a`);
    expect(req.request.body).toEqual({ amount: '5.00' });
    req.flush(
      { code: 'cart.amount_below_minimum', min: '10.00' },
      { status: 422, statusText: 'x' },
    );
    expect(await done).toBe(false);
    expect(store.lines()[0].amount).toBe('50.00');
    expect(store.lastProblem()?.code).toBe('cart.amount_below_minimum');
    expect(store.lastProblem()?.extra['min']).toBe('10.00');
  });

  it('W-3: clear() waits for an in-flight add, so the add cannot bring cleared lines back', async () => {
    const adding = store.add({ kind: 'project', projectId: 'p-new', amount: '75', preview });
    const clearing = store.clear();
    await tick();
    // Only the add is on the wire; the clear is queued behind it.
    const add = http.expectOne(`${API}/cart/lines`);
    http.expectNone((r) => r.method === 'DELETE');
    add.flush(cart([line('a'), line('b')]));
    await adding;
    await tick();
    const del = http.expectOne((r) => r.method === 'DELETE' && r.url === `${API}/cart`);
    del.flush(null, { status: 204, statusText: 'No Content' });
    expect(await clearing).toBe(true);
    expect(store.lines()).toEqual([]);
    expect(TestBed.inject(CartSummary).count()).toBe(0);
  });

  it('W-3: refresh() is queued too and replaces the view with the server cart', async () => {
    const adding = store.add({ kind: 'category', categoryId: 'c', amount: '100', preview });
    const refreshing = store.refresh();
    await tick();
    http.expectOne(`${API}/cart/lines`).flush(cart([line('a'), line('c')]));
    await adding;
    await tick();
    http.expectOne(`${API}/cart`).flush(cart([line('a'), line('c'), line('merged')]));
    expect(await refreshing).toBe(true);
    expect(store.lines().map((l) => l.id)).toEqual(['a', 'c', 'merged']);
  });

  it('a failed clear restores the lines', async () => {
    const clearing = store.clear();
    await tick();
    expect(store.lines()).toEqual([]);
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush({ code: 'auth.account_blocked' }, { status: 403, statusText: 'x' });
    expect(await clearing).toBe(false);
    expect(store.lines().map((l) => l.id)).toEqual(['a']);
  });
});
