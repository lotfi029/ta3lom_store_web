import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext, httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, linkedSignal, signal } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';
import type { Cart, CartLine, CartNotice, Quote, QuoteLine } from '../api/api.types';
import { toInt } from '../api/api.types';
import { PURCHASE_LINE } from '../api/pre-r4';
import { type StoreProblem, toProblem } from '../api/problem';
import { STORE_API_URL } from '../api/store-api-url';
import { StoreAuth } from '../auth/store-auth';
import { SILENT } from '../http/error-toast.interceptor';
import { valueOf } from '../http/resource-value';
import { add, sum, times, toHalalas } from '../money/money';
import { CartSummary } from './cart-summary';

export interface CartDraft {
  productId: string;
  bookFormatId: string | null;
  quantity: number;
  /** What the buyer saw, for the optimistic line (the server's answer replaces it). */
  preview?: { slug: string; type: string; titleAr: string; titleEn: string | null; unitPrice: string; formatKind: string | null };
}

/** RUL-14 on the client: the same product + format merges into one line; otherwise a provisional line is appended. */
export function mergeOrAppend(lines: readonly CartLine[], draft: CartDraft): readonly CartLine[] {
  const same = lines.find((l) => l.productId === draft.productId && (l.bookFormat?.id ?? null) === draft.bookFormatId);
  if (same) {
    const q = Math.min(toInt(same.maxQuantity, 20) || 20, toInt(same.quantity, 1) + draft.quantity);
    return lines.map((l) => (l === same ? { ...l, quantity: q, amount: times(l.unitPrice, q) } : l));
  }
  const p = draft.preview;
  if (!p) return lines;
  const provisional = {
    id: `pending-${draft.productId}-${draft.bookFormatId ?? ''}`,
    productId: draft.productId,
    slug: p.slug,
    type: p.type,
    kind: 'buy',
    mode: 'units',
    titleAr: p.titleAr,
    titleEn: p.titleEn,
    bookFormat: draft.bookFormatId && p.formatKind ? { id: draft.bookFormatId, kind: p.formatKind } : null,
    quantity: draft.quantity,
    maxQuantity: p.formatKind === 'print' ? 20 : 1,
    unitPrice: p.unitPrice,
    amount: times(p.unitPrice, draft.quantity),
    unitLabelAr: null,
    unitLabelEn: null,
    seatEquivalent: null,
    intent: null,
    dedication: null,
    issues: [],
  } as CartLine;
  return [...lines, provisional];
}

/**
 * The cart (10 §6, 11 §3, #10–#15). The server is the source of truth: every response REPLACES the local view; edits
 * are optimistic, serialised (a slow response never overwrites a newer one) and rolled back on failure, with the
 * problem in `lastProblem`. Lazily loaded: only cart, checkout and product pages import it. r4: purchases only
 * (a pre-r4 API's `gifts` group is never shown).
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly summary = inject(CartSummary);
  private readonly auth = inject(StoreAuth);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly enabled = signal(false);
  private readonly remote = httpResource<Cart>(() => (this.browser && this.enabled() ? `${this.api}/cart` : undefined));
  /** The last cart the server sent (from GET or from a mutation). */
  private readonly server = linkedSignal<Cart | undefined>(() => valueOf(this.remote));

  /** Local view: resets to the server's lines whenever the server answers; optimistic edits write here. */
  readonly lines = linkedSignal<readonly CartLine[]>(() => this.server()?.purchases ?? []);
  readonly loading = computed(() => this.enabled() && this.remote.isLoading() && !this.server());
  readonly loadError = computed(() => !!this.remote.error() && !this.server());
  readonly pending = signal(0);
  readonly lastProblem = signal<StoreProblem | null>(null);
  /**
   * RUL-15: the cart keeps the price the visitor saw; only the checkout quote reprices. The cart page asks for a quote
   * (`checkPrices`) and shows what moved. Any new server cart invalidates it.
   */
  readonly quote = linkedSignal<Cart | undefined, Quote | null>({ source: () => this.server(), computation: () => null });
  readonly priceChanged = computed(() => (this.quote()?.lines ?? []).filter((l) => l.status === 'changed').map((l) => l.lineId));

  readonly count = computed(() => this.lines().length);
  readonly isEmpty = computed(() => this.server() !== undefined && this.lines().length === 0);
  readonly hasPrint = computed(() => this.lines().some((l) => l.bookFormat?.kind === 'print'));
  readonly issues = computed(() => this.lines().filter((l) => l.issues.length > 0));
  /** Merge notices (RUL-17) from the last sign-in plus the server's own cart notices. */
  readonly notices = computed<CartNotice[]>(() => [...this.auth.cartNotices(), ...(this.server()?.notices ?? [])]);

  /**
   * Totals. With no edit in flight these are the server's own figures; during an optimistic edit they are estimated in
   * halalas from the local lines (shipping = the server's flat fee when a print line exists, RUL-26).
   */
  readonly totals = computed(() => {
    const s = this.server()?.summary;
    const q = this.quote();
    const purchases = sum(this.lines().map((l) => l.amount));
    if (s && q?.priceChanged && this.pending() === 0) {
      return { purchases: q.purchasesTotal, shipping: q.shippingTotal, vat: q.vatTotal, grand: add(q.purchasesTotal, q.shippingTotal), requiresShipping: q.requiresShipping };
    }
    if (s && this.pending() === 0) {
      return { purchases: s.purchasesTotal, shipping: s.shippingTotal, vat: s.vatIncluded, grand: s.grandTotal, requiresShipping: s.requiresShipping };
    }
    const shipping = this.hasPrint() ? (s && toHalalas(s.shippingTotal) > 0 ? s.shippingTotal : this.lastShippingFee) : '0.00';
    return { purchases, shipping, vat: s?.vatIncluded ?? '0.00', grand: add(purchases, shipping), requiresShipping: this.hasPrint() };
  });

  private lastShippingFee = '25.00';
  private queue: Promise<unknown> = Promise.resolve();

  /** Starts loading (or reloads) the cart — cart, checkout and product pages call this. */
  load(): void {
    if (!this.browser) return;
    if (this.enabled()) this.remote.reload();
    else this.enabled.set(true);
  }

  reload(): void {
    this.load();
  }

  add(draft: CartDraft): Promise<boolean> {
    const body = { ...PURCHASE_LINE, productId: draft.productId, bookFormatId: draft.bookFormatId, quantity: draft.quantity };
    return this.mutate((lines) => mergeOrAppend(lines, draft), () => this.http.post<Cart>(`${this.api}/cart/lines`, body), true);
  }

  setQuantity(lineId: string, quantity: number): Promise<boolean> {
    const line = this.lines().find((l) => l.id === lineId);
    const max = line ? toInt(line.maxQuantity, 20) || 20 : 20;
    const q = Math.min(Math.max(Math.trunc(quantity) || 1, 1), max);
    return this.mutate(
      (lines) => lines.map((l) => (l.id === lineId ? { ...l, quantity: q, amount: times(l.unitPrice, q) } : l)),
      () => this.http.patch<Cart>(`${this.api}/cart/lines/${lineId}`, { quantity: q }),
    );
  }

  remove(lineId: string): Promise<boolean> {
    return this.mutate(
      (lines) => lines.filter((l) => l.id !== lineId),
      () => this.http.delete<Cart>(`${this.api}/cart/lines/${lineId}`),
    );
  }

  /** Reprices the current cart without writing (#40); failures are silent — checkout reprices again anyway. */
  async checkPrices(): Promise<void> {
    const cart = this.server();
    if (!this.browser || !cart || cart.purchases.length === 0 || this.pending() > 0) return;
    try {
      const q = await firstValueFrom(this.http.post<Quote>(`${this.api}/checkout/quote`, {}, { context: new HttpContext().set(SILENT, true) }));
      if (this.server() === cart) this.quote.set(q);
    } catch {
      // The cart page stays on the stored prices.
    }
  }

  /** The repriced line when the quote moved its price, else null. */
  repriced(lineId: string): QuoteLine | null {
    return this.quote()?.lines.find((l) => l.lineId === lineId && l.status === 'changed') ?? null;
  }

  /** Forget the merge notices once shown. */
  dismissNotices(): void {
    this.auth.cartNotices.set([]);
  }

  private mutate(apply: (l: readonly CartLine[]) => readonly CartLine[], call: () => Observable<Cart>, bump = false): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      const before = this.lines();
      this.lines.set(apply(before));
      this.pending.update((n) => n + 1);
      try {
        const cart = await firstValueFrom(call());
        this.accept(cart, bump);
        this.lastProblem.set(null);
        return true;
      } catch (e) {
        this.lines.set(before);
        this.lastProblem.set(toProblem(e));
        return false;
      } finally {
        this.pending.update((n) => n - 1);
      }
    };
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
  }

  private accept(cart: Cart, bump: boolean): void {
    this.enabled.set(true);
    this.server.set(cart);
    if (toHalalas(cart.summary.shippingTotal) > 0) this.lastShippingFee = cart.summary.shippingTotal;
    this.summary.set({ lineCount: cart.summary.lineCount, grandTotal: cart.summary.grandTotal }, bump);
  }

  /** The current server cart (checkout reads the line ids and the requires-shipping flag). */
  readonly snapshot = computed(() => this.server());
}

