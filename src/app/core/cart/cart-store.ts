import { isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, linkedSignal, signal } from '@angular/core';
import { type Observable, firstValueFrom, map } from 'rxjs';
import type { AddCartLine, Cart, CartLine, CartNotice } from '../api/api.types';
import { toInt } from '../api/api.types';
import { type StoreProblem, toProblem } from '../api/problem';
import { STORE_API_URL } from '../api/store-api-url';
import { StoreConfig } from '../api/store-config';
import { StoreAuth } from '../auth/store-auth';
import { valueOf } from '../http/resource-value';
import { normalize, sum, times } from '../money/money';
import { CartSummary } from './cart-summary';

/** What the donor saw, for the optimistic line (the server's answer replaces it). */
export interface LinePreview {
  titleAr: string;
  titleEn: string | null;
  slug: string | null;
  optionLabelAr?: string | null;
  optionLabelEn?: string | null;
}

/** The three gift-line shapes of D-01 (contract 15 §2.3 `AddCartLineRequest`). */
export type CartDraft =
  | {
      kind: 'option';
      projectId: string;
      optionId: string;
      quantity: number;
      unitAmount: string;
      preview: LinePreview;
    }
  | { kind: 'project'; projectId: string; amount: string; preview: LinePreview }
  | { kind: 'category'; categoryId: string; amount: string; preview: LinePreview };

/**
 * The request body for a draft: exactly one shape per kind (the other members are sent as null, which the API reads
 * like absent ones). Amounts are normalised `"50.00"` strings.
 */
export function lineBody(draft: CartDraft): AddCartLine {
  const none = { projectId: null, optionId: null, categoryId: null, amount: null, quantity: null };
  switch (draft.kind) {
    case 'option':
      return {
        ...none,
        projectId: draft.projectId,
        optionId: draft.optionId,
        quantity: draft.quantity,
      };
    case 'project':
      return { ...none, projectId: draft.projectId, amount: normalize(draft.amount) };
    case 'category':
      return { ...none, categoryId: draft.categoryId, amount: normalize(draft.amount) };
  }
}

export const lineKind = (l: CartLine): 'option' | 'project' | 'category' =>
  l.targetKind === 'category' ? 'category' : l.optionId ? 'option' : 'project';

/**
 * The optimistic view of an add: the same option adds to its existing line (the API does the same); every amount line is
 * a new line. `maxQuantity` comes from `/catalog/config` (W-5).
 */
export function mergeOrAppend(
  lines: readonly CartLine[],
  draft: CartDraft,
  maxQuantity: number,
): readonly CartLine[] {
  if (draft.kind === 'option') {
    const same = lines.find((l) => l.optionId === draft.optionId);
    if (same) {
      const q = Math.min(maxQuantity, toInt(same.quantity, 1) + draft.quantity);
      return lines.map((l) =>
        l === same ? { ...l, quantity: q, amount: times(l.unitAmount, q) } : l,
      );
    }
  }
  const p = draft.preview;
  const unit = draft.kind === 'option' ? draft.unitAmount : normalize(draft.amount);
  const quantity = draft.kind === 'option' ? draft.quantity : 1;
  const provisional: CartLine = {
    id: `pending-${lines.length}-${draft.kind}`,
    targetKind: draft.kind === 'category' ? 'category' : 'project',
    projectId: draft.kind === 'category' ? null : draft.projectId,
    projectSlug: draft.kind === 'category' ? null : p.slug,
    categoryId: draft.kind === 'category' ? draft.categoryId : null,
    categorySlug: draft.kind === 'category' ? p.slug : null,
    optionId: draft.kind === 'option' ? draft.optionId : null,
    titleAr: p.titleAr,
    titleEn: p.titleEn,
    optionLabelAr: p.optionLabelAr ?? null,
    optionLabelEn: p.optionLabelEn ?? null,
    quantity,
    unitAmount: unit,
    amount: times(unit, quantity),
    problems: [],
  };
  return [...lines, provisional];
}

const EMPTY_CART: Cart = { lines: [], lineCount: 0, totalAmount: '0.00', problems: [] };

/**
 * The donation cart (contract 15 §2.3). The server is the source of truth: every response REPLACES the local view.
 * Every write — add, quantity, amount, remove, clear — and every refresh goes through ONE queue (W-3), so a slow
 * response never overwrites a newer one and an in-flight add can't bring cleared lines back. Edits are optimistic and
 * rolled back on failure, with the problem in `lastProblem`. `GET /v1/cart` is already re-priced and carries the
 * per-line and cart-level `problems`.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly summary = inject(CartSummary);
  private readonly auth = inject(StoreAuth);
  private readonly config = inject(StoreConfig);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly enabled = signal(false);
  private readonly remote = httpResource<Cart>(() =>
    this.browser && this.enabled() ? `${this.api}/cart` : undefined,
  );
  /** The last cart the server sent (from GET or from a write). */
  private readonly server = linkedSignal<Cart | undefined>(() => valueOf(this.remote));

  /** Local view: resets to the server's lines whenever the server answers; optimistic edits write here. */
  readonly lines = linkedSignal<readonly CartLine[]>(() => this.server()?.lines ?? []);
  readonly loading = computed(() => this.enabled() && this.remote.isLoading() && !this.server());
  readonly loadError = computed(() => !!this.remote.error() && !this.server());
  readonly pending = signal(0);
  readonly lastProblem = signal<StoreProblem | null>(null);

  readonly count = computed(() => this.lines().length);
  readonly isEmpty = computed(() => this.server() !== undefined && this.lines().length === 0);
  /** Cart-level problems (`lineId: null`: too many lines, total exceeded) from the last server answer. */
  readonly cartProblems = computed(() =>
    (this.server()?.problems ?? []).filter((p) => !p.lineId).map((p) => p.code),
  );
  readonly hasProblems = computed(
    () => this.cartProblems().length > 0 || this.lines().some((l) => l.problems.length > 0),
  );
  /** Merge notices from the last sign-in (`cartNotices`). */
  readonly notices = computed<CartNotice[]>(() => this.auth.cartNotices());
  /** The server's total when no edit is in flight; during one, the local lines' sum (halalas). */
  readonly total = computed(() => {
    const s = this.server();
    return s && this.pending() === 0 ? s.totalAmount : sum(this.lines().map((l) => l.amount));
  });
  /** The maximum option quantity (config, W-5); 999 is the contract value until the config answers. */
  readonly maxQuantity = computed(() => this.config.maxQuantity() ?? 999);

  private queue: Promise<unknown> = Promise.resolve();

  /** Starts loading (or reloads) the cart — cart, checkout and project pages call this. */
  load(): void {
    if (!this.browser) return;
    if (this.enabled()) this.remote.reload();
    else this.enabled.set(true);
  }

  /** Fetches the cart now, in the queue, and replaces the view (after sign-in the guest cart was merged server-side). */
  refresh(): Promise<boolean> {
    if (!this.browser) return Promise.resolve(false);
    return this.mutate(
      (lines) => lines,
      () => this.http.get<Cart>(`${this.api}/cart`),
    );
  }

  add(draft: CartDraft): Promise<boolean> {
    return this.mutate(
      (lines) => mergeOrAppend(lines, draft, this.maxQuantity()),
      () => this.http.post<Cart>(`${this.api}/cart/lines`, lineBody(draft)),
      true,
    );
  }

  setQuantity(lineId: string, quantity: number): Promise<boolean> {
    const q = Math.min(Math.max(Math.trunc(quantity) || 1, 1), this.maxQuantity());
    return this.mutate(
      (lines) =>
        lines.map((l) =>
          l.id === lineId ? { ...l, quantity: q, amount: times(l.unitAmount, q) } : l,
        ),
      () => this.http.patch<Cart>(`${this.api}/cart/lines/${lineId}`, { quantity: q }),
    );
  }

  setAmount(lineId: string, amount: string): Promise<boolean> {
    const a = normalize(amount);
    return this.mutate(
      (lines) => lines.map((l) => (l.id === lineId ? { ...l, unitAmount: a, amount: a } : l)),
      () => this.http.patch<Cart>(`${this.api}/cart/lines/${lineId}`, { amount: a }),
    );
  }

  remove(lineId: string): Promise<boolean> {
    return this.mutate(
      (lines) => lines.filter((l) => l.id !== lineId),
      () => this.http.delete<Cart>(`${this.api}/cart/lines/${lineId}`),
    );
  }

  /** Empties the cart (`DELETE /v1/cart`, 204) — in the queue (W-3); the view clears at once. */
  clear(): Promise<boolean> {
    return this.mutate(
      () => [],
      () => this.http.delete(`${this.api}/cart`).pipe(map(() => EMPTY_CART)),
    );
  }

  /** After account deletion or sign-out: forget the local view without calling the API. */
  reset(): void {
    this.server.set(EMPTY_CART);
    this.summary.set({ lineCount: 0, totalAmount: '0.00' });
  }

  /** Forget the merge notices once shown. */
  dismissNotices(): void {
    this.auth.cartNotices.set([]);
  }

  private mutate(
    apply: (l: readonly CartLine[]) => readonly CartLine[],
    call: () => Observable<Cart>,
    bump = false,
  ): Promise<boolean> {
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
    this.summary.set({ lineCount: cart.lineCount, totalAmount: cart.totalAmount }, bump);
  }

  /** The current server cart. */
  readonly snapshot = computed(() => this.server());
}
