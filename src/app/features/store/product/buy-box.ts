import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import type { BookFormat, ProductDetail } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { times } from '../../../core/money/money';
import { Icon } from '../../../shared/ui/icon/icon';
import { Money } from '../../../shared/ui/money/money';
import { printAvailable } from './product.data';

export interface BuyRequest {
  productId: string;
  bookFormatId: string | null;
  quantity: number;
}

/**
 * Prototype `.buybox` for r4 (buy only — no sponsor tab, plan §2.6), FR-S10/S11, RUL-12:
 *   - course: one seat, quantity 1; an owned course shows "go to course" instead of add (RUL-13);
 *   - book: format radio (print / digital), print quantity 1…min(printMax, available), digital quantity 1;
 *     a print format with no stock is disabled and says so (RUL-30).
 * Presentational: it emits `add` / `buyNow`; the page talks to the cart.
 */
@Component({
  selector: 'ta-buy-box',
  imports: [Money, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buy-box.html',
  styleUrl: './buy-box.css',
})
export class BuyBox {
  private readonly i18n = inject(I18nService);
  readonly product = input.required<ProductDetail>();
  readonly coursePrice = input<string | null>(null);
  readonly courseCompareAt = input<string | null>(null);
  readonly formats = input<BookFormat[]>([]);
  readonly printMax = input(20);
  readonly owned = input(false);
  readonly busy = input(false);
  readonly actions = input(true);

  readonly add = output<BuyRequest>();
  readonly buyNow = output<BuyRequest>();
  readonly goToCourse = output<void>();

  protected readonly isBook = computed(() => this.product().type === 'book');
  protected readonly formatId = signal<string | null>(null);
  protected readonly qty = signal(1);

  protected readonly selected = computed<BookFormat | null>(() => {
    const id = this.formatId();
    const fs = this.formats();
    return fs.find((f) => f.id === id) ?? fs.find((f) => this.inStock(f)) ?? fs[0] ?? null;
  });
  protected readonly maxQty = computed(() => {
    const f = this.selected();
    if (!f) return 1;
    if (f.kind !== 'print') return 1;
    const cap = Math.min(this.printMax(), toInt(f.maxQuantity, this.printMax()) || this.printMax());
    const avail = printAvailable(f);
    return Math.max(1, avail === null ? cap : Math.min(cap, avail));
  });
  protected readonly price = computed(() => (this.isBook() ? (this.selected()?.price ?? null) : this.coursePrice()));
  protected readonly total = computed(() => {
    const p = this.price();
    return p ? times(p, this.isBook() ? this.qty() : 1) : null;
  });
  protected readonly soldOut = computed(() => this.isBook() && !!this.selected() && !this.inStock(this.selected()!));
  protected readonly lessons = computed(() => toInt(this.product().course?.lessons));

  constructor() {
    // Keep the quantity inside the selected format's limits (digital = 1, print = stock / max).
    effect(() => {
      const max = this.maxQty();
      if (this.qty() > max) this.qty.set(max);
    });
  }

  protected inStock(f: BookFormat): boolean {
    const a = printAvailable(f);
    return a === null || a > 0;
  }

  protected formatLabel(f: BookFormat): string {
    return f.kind === 'print' ? $localize`:@@store.card.format-print:نسخة مطبوعة` : $localize`:@@store.card.format-digital:نسخة رقمية PDF`;
  }

  protected step(delta: number): void {
    this.qty.update((q) => Math.min(this.maxQty(), Math.max(1, q + delta)));
  }

  protected typed(value: string): void {
    const n = Math.trunc(Number(value));
    this.qty.set(Number.isFinite(n) ? Math.min(this.maxQty(), Math.max(1, n)) : 1);
  }

  protected request(): BuyRequest | null {
    if (this.isBook()) {
      const f = this.selected();
      if (!f || !this.inStock(f)) return null;
      return { productId: this.product().id, bookFormatId: f.id, quantity: f.kind === 'print' ? this.qty() : 1 };
    }
    return { productId: this.product().id, bookFormatId: null, quantity: 1 };
  }

  protected emitAdd(): void {
    const r = this.request();
    if (r) this.add.emit(r);
  }

  protected emitBuyNow(): void {
    const r = this.request();
    if (r) this.buyNow.emit(r);
  }

  protected readonly locale = this.i18n.locale;
}
