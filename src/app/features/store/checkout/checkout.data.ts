import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Cart,
  CartProblem,
  CheckoutRequest,
  CheckoutResponse,
  DonationPage,
} from '../../../core/api/api.types';
import { type StoreProblem, toProblem } from '../../../core/api/problem';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { SILENT } from '../../../core/http/error-toast.interceptor';
import type { Locale } from '../../../core/i18n/i18n';

export interface ContactInput {
  fullName: string;
  email: string;
  locale: Locale;
}

export type CheckoutOutcome =
  | { kind: 'created'; order: CheckoutResponse }
  /** U-3: the key was reused and the retry found the cart empty — an earlier attempt placed this order. */
  | { kind: 'recovered'; reference: string }
  | { kind: 'linesInvalid'; problems: CartProblem[] }
  | { kind: 'cartEmpty' }
  | { kind: 'contactRequired' }
  /** 409 `idempotency.in_progress` still after the retries — the first request is still running. */
  | { kind: 'inProgress' }
  | { kind: 'error'; problem: StoreProblem };

/** A fresh Idempotency-Key (8–64 characters; a UUID is 36). */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/**
 * R3-3: the checkout body, normalised ONCE — name and e-mail trimmed, e-mail lower-cased, blanks sent as null (the API
 * then keeps the profile's values), the locale always sent. This exact object is both hashed and sent.
 */
export function checkoutBody(c: ContactInput): CheckoutRequest {
  const fullName = c.fullName.trim();
  const email = c.email.trim().toLowerCase();
  return { fullName: fullName || null, email: email || null, locale: c.locale };
}

/** Canonical JSON (sorted keys) — the API hashes the bound body the same way, so equal strings = the same request. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value ?? null);
}

/** Outcomes after which the server is known to hold nothing for this key, or the order exists: the key is spent. */
const RETRYABLE = (p: StoreProblem): boolean =>
  p.status === 0 || p.status >= 500 || p.status === 429 || p.code === 'idempotency.in_progress';

/**
 * Checkout data (contract 15 §2.4, §1.10).
 *
 * Idempotency-Key (W-1, U-3, owner note P-2): the key is bound to the body `{key, body}`. It is KEPT across retries of
 * the same body after a network error, a 5xx, a 429 or 409 `idempotency.in_progress` — the first request may still
 * create the order, and a retry with the same key then gets that order back. It is ROTATED only after a definite
 * outcome: a 201, or a 4xx that is not one of those (the API releases the key on every non-2xx, so nothing is held).
 * A changed body (name, e-mail, locale) gets a new key before it is sent, because the API answers 422
 * `idempotency.key_reused` to the same key with another body. On `key_reused` anyway: new key, one retry; if that
 * retry says the cart is empty, the earlier attempt placed the order — its reference is the newest `pending_payment`
 * donation.
 */
@Injectable()
export class CheckoutData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);

  /** The current attempt: the key and the canonical body it was first used with. Exposed for tests. */
  attempt: { key: string; body: string } | null = null;
  /** Waits before re-sending after 409 `idempotency.in_progress` (ms). Tests set it to zeros. */
  inProgressDelays: readonly number[] = [1000, 2000, 4000];

  /** `POST /v1/checkout/quote`: the re-priced cart with its problems (nothing written). */
  quote(): Promise<Cart> {
    return firstValueFrom(
      this.http.post<Cart>(`${this.api}/checkout/quote`, null, {
        context: new HttpContext().set(SILENT, true),
      }),
    );
  }

  /** The key for this body: the current one when the body is unchanged, else a new one. */
  keyFor(body: CheckoutRequest): string {
    const canon = canonicalJson(body);
    if (!this.attempt || this.attempt.body !== canon)
      this.attempt = { key: newIdempotencyKey(), body: canon };
    return this.attempt.key;
  }

  async placeOrder(contact: ContactInput): Promise<CheckoutOutcome> {
    const body = checkoutBody(contact);
    let reused = false;
    for (let i = 0; ; i++) {
      const key = this.keyFor(body);
      try {
        const order = await firstValueFrom(
          this.http.post<CheckoutResponse>(`${this.api}/checkout`, body, {
            headers: { 'Idempotency-Key': key },
          }),
        );
        this.attempt = null;
        return { kind: 'created', order };
      } catch (e) {
        const p = toProblem(e);
        if (p.code === 'idempotency.in_progress' && i < this.inProgressDelays.length) {
          await new Promise((r) => setTimeout(r, this.inProgressDelays[i]));
          continue;
        }
        if (p.code === 'idempotency.key_reused' && !reused) {
          reused = true;
          this.attempt = null; // a new key for the same body, one retry
          continue;
        }
        if (!RETRYABLE(p)) this.attempt = null;
        if (p.code === 'checkout.cart_empty' && reused) {
          const ref = await this.newestPending();
          return ref ? { kind: 'recovered', reference: ref } : { kind: 'cartEmpty' };
        }
        switch (p.code) {
          case 'checkout.lines_invalid':
            return {
              kind: 'linesInvalid',
              problems: (p.extra['problems'] as CartProblem[] | undefined) ?? [],
            };
          case 'checkout.cart_empty':
            return { kind: 'cartEmpty' };
          case 'checkout.contact_required':
            return { kind: 'contactRequired' };
          case 'idempotency.in_progress':
            return { kind: 'inProgress' };
          default:
            return { kind: 'error', problem: p };
        }
      }
    }
  }

  /** The newest `pending_payment` donation of the signed-in donor (`GET /v1/me/donations?page=1`). */
  private async newestPending(): Promise<string | null> {
    try {
      const page = await firstValueFrom(
        this.http.get<DonationPage>(`${this.api}/me/donations`, {
          params: { page: 1, pageSize: 20 },
        }),
      );
      return page.items.find((d) => d.status === 'pending_payment')?.reference ?? null;
    } catch {
      return null;
    }
  }
}
