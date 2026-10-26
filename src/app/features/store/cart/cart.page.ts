import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CartLine } from '../../../core/api/api.types';
import { problemMessage } from '../../../core/api/problem-message';
import { StoreConfig } from '../../../core/api/store-config';
import { cartNoticeText } from '../../../core/cart/cart-notice-text';
import { CartStore } from '../../../core/cart/cart-store';
import { SeoService } from '../../../core/seo/seo.service';
import { QuickDonate } from '../../../core/ui/quick-donate.service';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { CartLineView } from './cart-line';
import { type Limits, lineProblem } from './line-problems';

/**
 * `/cart` (W-M3): the donation cart — option, project-amount and category-amount lines with inline problems and their
 * fixes, cart-level limits (lines, total) with the values from `/catalog/config`, remove and clear (with a
 * confirmation). Every write goes through the cart store's queue; the server's answer replaces the view.
 * Client-rendered, noindex.
 */
@Component({
  selector: 'ta-cart-page',
  imports: [RouterLink, Dialog, Icon, Money, ResourceState, CartLineView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.css',
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  private readonly config = inject(StoreConfig);
  private readonly quick = inject(QuickDonate);
  private readonly router = inject(Router);

  protected readonly confirmClear = signal(false);
  protected readonly limits = computed<Limits>(() => ({
    minGiftAmount: this.config.minGiftAmount(),
    maxLineAmount: this.config.maxLineAmount(),
    cartMaxLines: this.config.cartMaxLines(),
    cartMaxTotal: this.config.cartMaxTotal(),
  }));
  protected readonly cartProblems = computed(() =>
    this.cart.cartProblems().map((code) => lineProblem(code, null, this.limits()).text),
  );
  protected readonly lastProblem = computed(() => {
    const p = this.cart.lastProblem();
    return p ? problemMessage(p) : null;
  });
  protected readonly blocked = computed(() => this.cart.pending() > 0 || this.cart.hasProblems());
  protected readonly noticeText = cartNoticeText;

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: $localize`:@@store.cart.title-r5:سلة التبرعات`,
      description: $localize`:@@store.cart.title-r5:سلة التبرعات`,
      path: '/cart',
      noindex: true,
    });
    this.cart.load();
  }

  protected setQuantity(l: CartLine, q: number): void {
    void this.cart.setQuantity(l.id, q);
  }

  protected setAmount(l: CartLine, a: string): void {
    void this.cart.setAmount(l.id, a);
  }

  protected remove(l: CartLine): void {
    void this.cart.remove(l.id);
  }

  protected async clear(): Promise<void> {
    this.confirmClear.set(false);
    await this.cart.clear();
  }

  protected openQuick(event: Event): void {
    this.quick.show(event.currentTarget);
  }

  protected checkout(event: Event): void {
    event.preventDefault();
    if (!this.blocked()) void this.router.navigateByUrl('/checkout');
  }
}
