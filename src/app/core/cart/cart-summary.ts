import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type CartBadge, toInt } from '../api/api.types';
import { STORE_API_URL } from '../api/store-api-url';
import { SILENT } from '../http/error-toast.interceptor';

/**
 * The header cart badge (11 §3.3, #11) — part of the initial bundle, so it stays tiny. The full cart (CartStore) is a
 * lazy feature service that calls `set()` after every change; the server is the truth (plan §2.4). Browser only: the
 * prerendered page never shows a badge count.
 */
@Injectable({ providedIn: 'root' })
export class CartSummary {
  private readonly http = inject(HttpClient);
  private readonly api = inject(STORE_API_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly state = signal<CartBadge | null>(null);
  readonly count = computed(() => toInt(this.state()?.lineCount));
  readonly grandTotal = computed(() => this.state()?.grandTotal ?? '0.00');
  /** Increments on every change that adds items — the header plays its "bump" on it. */
  readonly bumps = signal(0);

  async load(): Promise<number> {
    if (!this.browser) return 0;
    try {
      this.state.set(
        await firstValueFrom(
          this.http.get<CartBadge>(`${this.api}/cart/summary`, {
            context: new HttpContext().set(SILENT, true),
          }),
        ),
      );
    } catch {
      /* the badge is decoration; a failure leaves the last value */
    }
    return this.count();
  }

  set(badge: CartBadge, bump = false): void {
    const before = this.count();
    this.state.set(badge);
    if (bump && this.count() >= before) this.bumps.update((n) => n + 1);
  }
}
