import { Injectable, computed, inject, signal } from '@angular/core';
import { SHOWCASE } from '../showcase/showcase';

/**
 * Opens the quick-donate modal ("تبرع سريع", donations MVP §1.3) from anywhere — the header button and the floating side
 * button in the layout. The modal itself lives in the app root and is loaded on first use (`@defer`), so the initial
 * bundle carries only this flag.
 */
@Injectable({ providedIn: 'root' })
export class QuickDonate {
  readonly open = signal(false);
  /** True once opened: the deferred modal stays loaded afterwards. */
  readonly used = signal(false);
  /**
   * How many active categories accept general gifts, once any page (home) or the root `GiftCategories` read has seen
   * `/catalog/categories`; null = not known yet. The entry points show only when the count is known AND > 0 (owner M-4,
   * review 06 F-5): unknown hides them, so they never appear on a store with no gift category.
   */
  readonly giftCategoryCount = signal<number | null>(null);
  /** Showcase mode (SW-2): never — no header button, no floating button, no home card. */
  readonly available = computed(() => !this.showcase && (this.giftCategoryCount() ?? 0) > 0);
  private readonly showcase = inject(SHOWCASE);
  /** The control to give focus back to when the modal closes (the native dialog restores it on its own too). */
  private opener: HTMLElement | null = null;

  show(opener?: EventTarget | null): void {
    this.opener = opener instanceof HTMLElement ? opener : null;
    this.used.set(true);
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
    this.opener?.focus();
    this.opener = null;
  }
}
