import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
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
import { valueOf } from '../../../core/http/resource-value';

/** Order states after which polling stops. */
export const TERMINAL = new Set(['paid', 'payment_review', 'cancelled', 'expired']);
export const FAST_MS = 2_000;
export const FAST_FOR_MS = 60_000;
export const SLOW_MS = 10_000;
export const GIVE_UP_MS = 10 * 60_000;

/** Polling cadence (payments on only): every 2 s for 60 s, then every 10 s; null once 10 minutes have passed. */
export function pollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= GIVE_UP_MS) return null;
  return elapsedMs < FAST_FOR_MS ? FAST_MS : SLOW_MS;
}

/** API-2: the status route matches the reference case-sensitively and references are stored upper-case. */
export const normalizeRef = (ref: string): string => ref.trim().toUpperCase();

const TOKEN_KEY = (ref: string) => `t3s-order-t:${ref}`;

/**
 * E-2: the status token of an order (`?t=` from the checkout or the SMS/e-mail link) is kept in memory and in
 * sessionStorage (per reference, this tab only) and removed from the address bar, so it never reaches a referrer, the
 * history or a shared link. It is not a credential for anything but this order's status.
 */
export class OrderTokens {
  private readonly memory = new Map<string, string>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null) {}

  remember(ref: string, token: string): void {
    this.memory.set(ref, token);
    try {
      this.storage?.setItem(TOKEN_KEY(ref), token);
    } catch {
      /* private mode: memory only */
    }
  }

  get(ref: string): string | null {
    const m = this.memory.get(ref);
    if (m) return m;
    try {
      return this.storage?.getItem(TOKEN_KEY(ref)) ?? null;
    } catch {
      return null;
    }
  }
}

/** One per app: the checkout remembers the token, the order page reads it. */
@Injectable({ providedIn: 'root' })
export class OrderTokenStore extends OrderTokens {
  constructor() {
    const doc = inject(DOCUMENT);
    super(
      isPlatformBrowser(inject(PLATFORM_ID)) ? (doc.defaultView?.sessionStorage ?? null) : null,
    );
  }
}

/**
 * R3-2: the status request sends the donor's bearer when signed in (the interceptor adds it) AND the token when known.
 * Without either there is no request — the page asks the donor to sign in.
 */
export function statusRequest(
  api: string,
  ref: string,
  signedIn: boolean,
  token: string | null,
): { url: string; params?: { t: string } } | undefined {
  if (!ref) return undefined;
  const url = `${api}/orders/${encodeURIComponent(ref)}/status`;
  if (!signedIn && !token) return undefined;
  return token ? { url, params: { t: token } } : { url };
}

export type OrderView = 'loading' | 'ready' | 'signIn' | 'notFound' | 'error';

/**
 * The order page data (`GET /v1/orders/{reference}/status`). With `environment.paymentsEnabled = false` (D-W2) the
 * pending order is the end state: no polling. With payments on, it polls until a terminal state or 10 minutes, and
 * stops at once on any 4xx (W-4).
 */
@Injectable()
export class OrderData {
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StoreAuth);
  private readonly tokens = inject(OrderTokenStore);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly paymentsEnabled = environment.paymentsEnabled;

  readonly ref = signal('');
  readonly token = signal<string | null>(null);
  readonly gaveUp = signal(false);
  private startedAt = Date.now();

  readonly status = httpResource<OrderStatus>(() =>
    this.browser
      ? statusRequest(this.api, this.ref(), this.auth.isSignedIn(), this.token())
      : undefined,
  );
  readonly value = computed(() => valueOf(this.status));
  readonly state = computed(() => this.value()?.status ?? null);
  readonly isTerminal = computed(() => TERMINAL.has(this.state() ?? ''));
  private readonly errorStatus = computed(() => {
    const e = this.status.error();
    return e instanceof HttpErrorResponse ? e.status : e ? 0 : null;
  });
  /** W-4: any 4xx is final — the answer will not change by asking again. */
  readonly clientError = computed(() => {
    const s = this.errorStatus();
    return s !== null && s >= 400 && s < 500;
  });

  readonly view = computed<OrderView>(() => {
    if (this.value()) return 'ready';
    const signedIn = this.auth.isSignedIn();
    if (!signedIn && !this.token()) return 'signIn';
    const s = this.errorStatus();
    if (s === 404 || s === 401)
      return signedIn || this.token() ? (signedIn ? 'notFound' : 'signIn') : 'signIn';
    if (s !== null) return 'error';
    return 'loading';
  });

  constructor() {
    effect((onCleanup) => {
      if (
        !this.browser ||
        !this.paymentsEnabled ||
        !this.ref() ||
        this.status.isLoading() ||
        this.isTerminal() ||
        this.clientError() ||
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
  }

  /** Opens an order: the reference upper-cased (API-2), the token from the URL (then remembered) or from earlier. */
  open(ref: string, urlToken: string | null): void {
    const r = normalizeRef(ref);
    if (urlToken) this.tokens.remember(r, urlToken);
    this.token.set(urlToken || this.tokens.get(r));
    this.startedAt = Date.now();
    this.ref.set(r);
  }

  /** "Check again" after the polling stopped: a new 10-minute window. */
  checkAgain(): void {
    this.startedAt = Date.now();
    this.gaveUp.set(false);
    this.status.reload();
  }
}
