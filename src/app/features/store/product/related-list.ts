import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProductCard } from '../../../shared/ui/product-card/product-card';
import { ProductData } from './product.data';

/** Related products, created only when the section scrolls into view (`@defer (on viewport)`), so it fetches then. */
@Component({
  selector: 'ta-related-list',
  imports: [ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="cards c3">
      @for (r of data.related(); track r.id) {
        <li><ta-product-card [product]="r" /></li>
      }
    </ul>
  `,
})
export class RelatedList {
  protected readonly data = inject(ProductData);

  constructor() {
    this.data.relatedWanted.set(true);
  }
}
