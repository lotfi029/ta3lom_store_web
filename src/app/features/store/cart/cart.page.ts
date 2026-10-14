import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CartLine, CartNotice } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { cartNoticeText } from '../../../core/cart/cart-notice-text';
import { CartStore } from '../../../core/cart/cart-store';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { Steps } from '../../../shared/ui/steps/steps';

/** `/cart` (FR-S17/S18, RUL-11–18): one group, "Your purchases" (r4). Client-rendered, noindex. */
@Component({
  selector: 'ta-cart-page',
  imports: [RouterLink, Icon, Money, ResourceState, Steps],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.css',
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly config = inject(StoreConfig);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  /** Stepper presses are debounced (300 ms) so five taps become one PATCH (10 §6). */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly wanted = new Map<string, number>();

  protected readonly problem = computed(() => {
    const p = this.cart.lastProblem();
    return p ? problemMessage(p) : null;
  });

  constructor() {
    this.seo.set({
      title: $localize`:@@store.cart.title:السلة`,
      description: $localize`:@@store.cart.seo-description:راجع الدورات والكتب في سلتك ثم أتمم الطلب.`,
      path: '/cart',
      noindex: true,
    });
    this.cart.load();
    // RUL-15: once the cart settles, ask for a quote so a moved price shows here, before checkout.
    effect(() => {
      if (this.cart.snapshot() && this.cart.pending() === 0)
        untracked(() => void this.cart.checkPrices());
    });
    inject(DestroyRef).onDestroy(() => {
      for (const t of this.timers.values()) clearTimeout(t);
      this.cart.dismissNotices();
    });
  }

  protected title(l: CartLine): string {
    return this.i18n.pick(l.titleAr, l.titleEn);
  }

  protected qty(l: CartLine): number {
    return this.wanted.get(l.id) ?? toInt(l.quantity, 1);
  }

  protected max(l: CartLine): number {
    return toInt(l.maxQuantity, 20) || 20;
  }

  protected step(l: CartLine, delta: number): void {
    const next = Math.min(this.max(l), Math.max(1, toInt(l.quantity, 1) + delta));
    if (next === toInt(l.quantity, 1)) return;
    this.wanted.set(l.id, next);
    // Optimistic display now; one PATCH after the presses settle.
    this.cart.lines.update((lines) =>
      lines.map((x) => (x.id === l.id ? { ...x, quantity: next } : x)),
    );
    clearTimeout(this.timers.get(l.id));
    this.timers.set(
      l.id,
      setTimeout(() => {
        this.wanted.delete(l.id);
        void this.cart.setQuantity(l.id, next);
      }, 300),
    );
  }

  protected clearAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    void this.cart.clear();
  }

  protected remove(l: CartLine): void {
    clearTimeout(this.timers.get(l.id));
    void this.cart.remove(l.id);
  }

  /** The checkout link waits for pending edits and for flagged lines to be fixed. */
  protected guard(event: Event): void {
    if (this.cart.pending() > 0 || this.cart.issues().length > 0) event.preventDefault();
  }

  protected issueText(code: string): string {
    return problemMessage({ code, status: 409 });
  }

  protected noticeText(n: CartNotice): string {
    return cartNoticeText(n);
  }
}
