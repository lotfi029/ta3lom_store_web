import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LiveItem, ProductCard as Card } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';
import { compare } from '../../../core/money/money';
import { Cover } from '../cover/cover';
import { Icon } from '../icon/icon';
import { Money } from '../money/money';

/**
 * Prototype `.pcard` for a course or a book (r4: no sponsorship tag, no goal bar). Whole card is one link.
 * The live figure (`/catalog/live`, browser only) wins over the build-time price; the card keeps its size either way.
 * The card heading level is configurable so every page keeps a correct outline (h2 sections → h3 cards).
 */
@Component({
  selector: 'ta-product-card',
  imports: [RouterLink, Cover, Icon, Money],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  private readonly i18n = inject(I18nService);
  readonly product = input.required<Card>();
  readonly live = input<LiveItem | null | undefined>(null);
  readonly headingLevel = input<2 | 3>(3);

  protected readonly title = computed(() => this.i18n.pick(this.product().titleAr, this.product().titleEn));
  protected readonly summary = computed(() => this.i18n.pick(this.product().summaryAr, this.product().summaryEn));
  protected readonly category = computed(() => {
    const c = this.product().category;
    return c ? this.i18n.pick(c.nameAr, c.nameEn) : null;
  });
  protected readonly isBook = computed(() => this.product().type === 'book');
  protected readonly formatKinds = computed(() => (this.live()?.formats ?? this.product().formats ?? []).map((f) => f.kind));
  protected readonly price = computed(() => {
    const live = this.live();
    if (this.isBook()) {
      const prices = (live?.formats ?? this.product().formats ?? []).map((f) => f.price);
      return prices.length ? prices.reduce((a, b) => (compare(a, b) <= 0 ? a : b)) : this.product().price;
    }
    return live?.price ?? this.product().price;
  });
  protected readonly compareAt = computed(() => (this.isBook() ? null : (this.live()?.compareAtPrice ?? this.product().compareAtPrice)));
  protected readonly fromPrice = computed(() => this.isBook() && this.formatKinds().length > 1);
}

