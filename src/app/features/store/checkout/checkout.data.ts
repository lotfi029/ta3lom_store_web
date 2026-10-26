import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Cart,
  CartProblem,
  CheckoutRequest,
  CheckoutResponse,
  DonationPage,
  DonationSummary,
} from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { type StoreProblem, toProblem } from '../../../core/api/problem';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { SILENT } from '../../../core/http/error-toast.interceptor';
import type { Locale } from '../../../core/i18n/i18n';
import { type Money, compare } from '../../../core/money/money';

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
  /**
   * The cart is empty. `checkMyDonations`: an earlier attempt may have placed the order but no pending donation matched
   * the last quote closely enough to open it — point the donor to "my donations" (F-4, R-2).
   */
  | { kind: 'cartEmpty'; checkMyDonations?: boolean }
  | { kind: 'contactRequired' }
  /** 409 `idempotency.in_progress` still after the retries — the first request is still running. */
  | { kind: 'inProgress' }
  | { kind: 'error'; problem: StoreProblem };

/** What the donor last saw on the checkout summary (`POST /v1/checkout/quote`): used to recognise a placed order. */
export interface QuoteSnapshot {
  lineCount: number;
  totalAmount: Money;
}

/** A recovered donation must be this recent (F-4): 15 min, plus 5 min either way for clock differences (R-2). */
export const RECOVERY_WINDOW_MS = 15 * 60_000;
export const CLOCK_TOLERANCE_MS = 5 * 60_000;

/**
 * Is this pending donation the order an earlier attempt placed? Same line count and total as the last quote, created
 * within the recovery window (R-2).
 */
export function matchesAttempt(d: DonationSummary, quote: QuoteSnapshot, now: number): boolean {
  if (d.status !== 'pending_payment') return false;
  if (toInt(d.lineCount) !== quote.lineCount || compare(d.totalAmount, quote.totalAmount) !== 0)
    return false;
  const age = now - Date.parse(d.createdAt);
  return (
    Number.isFinite(age) &&
    age >= -CLOCK_TOLERANCE_MS &&
    age <= RECOVERY_WINDOW_MS + CLOCK_TOLERANCE_MS
  );
}

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
 * After an UNKNOWN outcome (network error, 5xx, 429, `in_progress` given up) the order may exist although the donor saw
 * an error; a later 409 `checkout.cart_empty` then means it probably does (F-4).
 * A changed body (name, e-mail, locale) gets a new key before it is sent, because the API answers 422
 * `idempotency.key_reused` to the same key with another body. On `key_reused` anyway: new key, one retry; if that
 * retry — or, after an unknown outcome, the next attempt — says the cart is empty, the earlier attempt placed the order:
 * the newest `pending_payment` donation is opened only if it matches the last quote (line count and total) and was
 * created within 15 min (±5 min); otherwise the donor is pointed to "my donations" (R-2).
 */
@Injectable()
export class CheckoutData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);

  /** The current attempt: the key and the canonical body it was first used with. Exposed for tests. */
  attempt: { key: string; body: string } | null = null;
  /** Waits before re-sending after 409 `idempotency.in_progress` (ms). Tests set it to zeros. */
  inProgressDelays: readonly number[] = [1000, 2000, 4000];
  /** The clock for the recovery window. Tests replace it. */
  now: () => number = () => Date.now();
  /** An attempt in this checkout ended without a definite answer (network, 5xx, 429, in_progress): F-4. */
  private unknownOutcome = false;

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

  async placeOrder(
    contact: ContactInput,
    quote: QuoteSnapshot | null = null,
  ): Promise<CheckoutOutcome> {
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
        this.unknownOutcome = false;
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
        if (p.code === 'checkout.cart_empty' && (reused || this.unknownOutcome)) {
          const ref = await this.placedEarlier(quote);
          if (ref) this.unknownOutcome = false;
          return ref
            ? { kind: 'recovered', reference: ref }
            : { kind: 'cartEmpty', checkMyDonations: true };
        }
        if (RETRYABLE(p)) this.unknownOutcome = true;
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

  /**
   * The order an earlier attempt placed: the newest `pending_payment` donation of the signed-in donor
   * (`GET /v1/me/donations?page=1`, newest first), only if it matches the last quote and is recent (R-2).
   */
  private async placedEarlier(quote: QuoteSnapshot | null): Promise<string | null> {
    if (!quote) return null;
    try {
      const page = await firstValueFrom(
        this.http.get<DonationPage>(`${this.api}/me/donations`, {
          params: { page: 1, pageSize: 20 },
        }),
      );
      const newest = page.items.find((d) => d.status === 'pending_payment');
      return newest && matchesAttempt(newest, quote, this.now()) ? newest.reference : null;
    } catch {
      return null;
    }
  }
}
