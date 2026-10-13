import { HttpClient, HttpContext, httpResource } from '@angular/common/http';
import { Injectable, LOCALE_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  Address,
  CheckoutRequest,
  CheckoutResponse,
  Profile,
  Quote,
} from '../../../core/api/api.types';
import { type StoreProblem, toProblem } from '../../../core/api/problem';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';
import { SILENT } from '../../../core/http/error-toast.interceptor';
import { valueOf } from '../../../core/http/resource-value';
import { type CheckoutModel, toAddressInput } from './checkout.form';

export interface LineProblem {
  lineId: string;
  code: string;
}

export type CheckoutOutcome =
  | { kind: 'created'; order: CheckoutResponse }
  | { kind: 'priceChanged'; quote: Quote | null }
  | { kind: 'linesInvalid'; lines: LineProblem[] }
  | { kind: 'gatewayDown'; reference: string; statusToken: string }
  | { kind: 'error'; problem: StoreProblem };

/** A fresh Idempotency-Key per order attempt (11 §6.2). */
export const newIdempotencyKey = (): string => crypto.randomUUID();

/**
 * Checkout data (#40 quote, #41 place order, #21 profile, #24 addresses). The Idempotency-Key is kept across retries of
 * the same attempt (network error / 5xx: the server may already have the order) and replaced after any 4xx answer,
 * which created nothing — notably after `checkout.price_changed` (plan §2.5).
 */
@Injectable()
export class CheckoutData {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly auth = inject(StoreAuth);
  private readonly locale: 'ar' | 'en' = inject(LOCALE_ID).startsWith('en') ? 'en' : 'ar';

  /** Exposed for tests and for the page's busy state. */
  readonly idempotencyKey = signal(newIdempotencyKey());

  readonly profile = httpResource<Profile>(() =>
    this.auth.isSignedIn() ? `${this.api}/me` : undefined,
  );
  readonly addresses = httpResource<Address[]>(() =>
    this.auth.isSignedIn() ? `${this.api}/me/addresses` : undefined,
  );
  readonly savedAddresses = () => valueOf(this.addresses) ?? [];

  quote(): Promise<Quote> {
    return firstValueFrom(
      this.http.post<Quote>(
        `${this.api}/checkout/quote`,
        {},
        { context: new HttpContext().set(SILENT, true) },
      ),
    );
  }

  buildRequest(
    model: CheckoutModel,
    needsAddress: boolean,
    expectedGrandTotal: string,
  ): CheckoutRequest {
    const saved = needsAddress && model.savedId !== 'new' ? model.savedId : null;
    const inline = needsAddress && !saved ? toAddressInput(model.address) : null;
    return {
      contact: { fullName: model.name.trim(), email: model.email.trim() || null },
      isAnonymous: false, // r4: no donor list; the pre-r4 API still requires the flag
      shippingAddressId: saved,
      shippingAddress: inline,
      saveAddress: !!inline && model.saveAddress,
      paymentMethod: model.method,
      acceptTerms: true, // the form cannot submit unless the checkbox is ticked (FR-S30)
      expectedGrandTotal,
      locale: this.locale,
    };
  }

  async placeOrder(body: CheckoutRequest): Promise<CheckoutOutcome> {
    try {
      const order = await firstValueFrom(
        this.http.post<CheckoutResponse>(`${this.api}/checkout`, body, {
          headers: { 'Idempotency-Key': this.idempotencyKey() },
        }),
      );
      this.idempotencyKey.set(newIdempotencyKey());
      return { kind: 'created', order };
    } catch (e) {
      const p = toProblem(e);
      if (p.status >= 400 && p.status < 500) this.idempotencyKey.set(newIdempotencyKey());
      switch (p.code) {
        case 'checkout.price_changed':
          return { kind: 'priceChanged', quote: (p.extra['quote'] as Quote | undefined) ?? null };
        case 'checkout.lines_invalid':
          return {
            kind: 'linesInvalid',
            lines: (p.extra['lines'] as LineProblem[] | undefined) ?? [],
          };
        case 'checkout.gateway_unavailable':
          return {
            kind: 'gatewayDown',
            reference: String(p.extra['reference'] ?? ''),
            statusToken: String(p.extra['statusToken'] ?? ''),
          };
        default:
          return { kind: 'error', problem: p };
      }
    }
  }
}
