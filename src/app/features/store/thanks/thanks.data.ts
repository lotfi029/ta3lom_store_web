import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { environment } from '../../../../environments/environment';
import type { OrderStatus } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';
import { CartStore } from '../../../core/cart/cart-store';
import { CartSummary } from '../../../core/cart/cart-summary';
import { valueOf } from '../../../core/http/resource-value';

/** Order states after which polling stops (RUL-29). */
export const TERMINAL = new Set([
  'paid',
  'fulfilled',
  'payment_failed',
  'payment_review',
  'expired',
  'cancelled',
  'refunded',
  'partially_refunded',
]);
export const FAST_MS = 2_000;
export const FAST_FOR_MS = 60_000;
export const SLOW_MS = 10_000;
export const GIVE_UP_MS = 10 * 60_000;

/** The polling cadence of 11 §6.3: every 2 s for 60 s, then every 10 s; null once 10 minutes have passed. */
export function pollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= GIVE_UP_MS) return null;
  return elapsedMs < FAST_FOR_MS ? FAST_MS : SLOW_MS;
}

/**
 * The status request: the bearer when signed in, else the per-order status token (`?t=`). Never the reference alone
 * (r1-15) — without either there is no request. Any gateway parameter (`status`, `id`, `message`) is never forwarded
 * (RUL-33).
 */
export function statusRequest(
  api: string,
  ref: string,
  signedIn: boolean,
  token: string | null,
): { url: string; params?: { t: string } } | undefined {
  if (!ref) return undefined;
  const url = `${api}/orders/${encodeURIComponent(ref)}/status`;
  if (signedIn) return { url };
  return token ? { url, params: { t: token } } : undefined;
}

/** `https://…/v1` → `https://…` (the dev endpoints live outside `/v1`). */
export const apiOrigin = (api: string): string => api.replace(/\/v1$/, '');

/**
 * The thanks page data (#42 status, dev confirm-payment). Polls until a terminal state or 10 minutes; polls
 * at once when the tab becomes visible again; after a final expiry with `cartRestored` the cart is reloaded once.
 */
@Injectable()
export class ThanksData {
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StoreAuth);
  private readonly cart = inject(CartStore);
  private readonly summary = inject(CartSummary);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly ref = signal('');
  readonly statusToken = signal<string | null>(null);
  readonly gaveUp = signal(false);
  /** Dev and staging only (plan §2.7); `environment.production.ts` sets it to false. */
  readonly devTrigger = environment.devPaymentTrigger;
  private startedAt = Date.now();

  readonly status = httpResource<OrderStatus>(() =>
    this.browser
      ? statusRequest(this.api, this.ref(), this.auth.isSignedIn(), this.statusToken())
      : undefined,
  );
  readonly value = computed(() => valueOf(this.status));
  readonly state = computed(() => this.value()?.status ?? null);
  readonly isTerminal = computed(() => TERMINAL.has(this.state() ?? ''));

  constructor() {
    effect((onCleanup) => {
      if (
        !this.browser ||
        !this.ref() ||
        this.status.isLoading() ||
        this.isTerminal() ||
        this.gaveUp()
      )
        return;
      const delay = pollDelay(Date.now() - this.startedAt);
      if (delay === null) {
        untracked(() => this.gaveUp.set(true));
        return;
      }
      const id = setTimeout(() => this.status.reload(), delay);
      onCleanup(() => clearTimeout(id));
    });

    let restored = false;
    effect(() => {
      if (this.value()?.cartRestored && !restored) {
        restored = true;
        untracked(() => {
          this.cart.reload();
          void this.summary.load();
        });
      }
    });

    if (this.browser) {
      const doc = inject(DOCUMENT);
      const onVisible = () => {
        if (!doc.hidden && !this.isTerminal()) this.status.reload();
      };
      doc.addEventListener('visibilitychange', onVisible);
      inject(DestroyRef).onDestroy(() => doc.removeEventListener('visibilitychange', onVisible));
    }
  }

  /** "Check again" after giving up: a new 10-minute window. */
  checkAgain(): void {
    this.startedAt = Date.now();
    this.gaveUp.set(false);
    this.status.reload();
  }

  /**
   * Dev only: `POST /dev/orders/{ref}/confirm-payment` simulates a verified capture (doc 15 §2.4). The API's `/dev`
   * group has no CORS policy, so this is a body-less "simple" request (`no-cors`, opaque answer, no credentials); the
   * status poll shows the result.
   */
  async simulatePayment(): Promise<void> {
    if (!this.devTrigger || !this.browser) return;
    await fetch(
      `${apiOrigin(this.api)}/dev/orders/${encodeURIComponent(this.ref())}/confirm-payment`,
      { method: 'POST', mode: 'no-cors', credentials: 'omit' },
    );
    this.status.reload();
  }
}
