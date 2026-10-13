import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { StoreProductType } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { pageCount } from '../../../core/api/paged';
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService, breadcrumbJsonLd } from '../../../core/seo/seo.service';
import { ProductCard } from '../../../shared/ui/product-card/product-card';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { CATALOG_SORTS, CatalogData, type CatalogSort, liveMap, pageOf, sortOf, storeItems } from './catalog.data';

/**
 * `/courses` and `/books` (plan §2.2, FR-S02): category chips from the API, sort, paging — all in the query string
 * (`?category=kids&sort=newest&page=2`). The prerendered HTML is the unfiltered first page; canonical drops the query.
 */
@Component({
  selector: 'ta-catalog-page',
  imports: [RouterLink, ProductCard, ResourceState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.css',
})
export class CatalogPage {
  private readonly data = inject(CatalogData);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  /** Route data. */
  readonly type = input.required<StoreProductType>();
  /** Query parameters (component input binding). */
  readonly category = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly sortValue = computed(() => sortOf(this.sort()));
  protected readonly pageValue = computed(() => pageOf(this.page()));
  protected readonly sorts = CATALOG_SORTS;

  protected readonly categories = this.data.categoriesResource();
  protected readonly catList = computed(() => valueOf(this.categories) ?? []);
  protected readonly list = this.data.listResource(() => ({
    type: this.type(),
    category: this.category() || null,
    sort: this.sortValue(),
    page: this.pageValue(),
  }));
  protected readonly items = computed(() => storeItems(valueOf(this.list)));
  protected readonly live = this.data.liveResource(() => this.items().map((p) => p.slug));
  protected readonly liveBySlug = computed(() => liveMap(this.live.value()));
  protected readonly pages = computed(() => pageCount(valueOf(this.list)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));

  protected readonly heading = computed(() =>
    this.type() === 'course' ? $localize`:@@store.catalog.courses-title:الدورات` : $localize`:@@store.catalog.books-title:الكتب`,
  );
  protected readonly lede = computed(() =>
    this.type() === 'course'
      ? $localize`:@@store.catalog.courses-lede:دورات عملية من إنتاج الجمعية، تتعلّمها بالسرعة التي تناسبك.`
      : $localize`:@@store.catalog.books-lede:كتب الجمعية مطبوعة تصلك بالشحن، أو رقمية تحمّلها فورًا من حسابك.`,
  );
  protected readonly path = computed(() => (this.type() === 'course' ? '/courses' : '/books'));

  constructor() {
    refreshAfterHydration(this.categories, this.list);
    effect(() => {
      const home = $localize`:@@store.layout.nav-home:الرئيسية`;
      this.seo.set({
        title: this.heading(),
        description: this.lede(),
        path: this.path(),
        jsonLd: breadcrumbJsonLd([
          [home, this.seo.url(this.i18n.locale, '/')],
          [this.heading(), this.seo.url(this.i18n.locale, this.path())],
        ]),
      });
    });
  }

  protected categoryName(c: { nameAr: string; nameEn?: string | null }): string {
    return this.i18n.pick(c.nameAr, c.nameEn);
  }

  protected sortLabel(s: CatalogSort): string {
    switch (s) {
      case 'newest':
        return $localize`:@@store.catalog.sort-newest:الأحدث`;
      case 'price_asc':
        return $localize`:@@store.catalog.sort-price-asc:السعر: من الأقل`;
      case 'price_desc':
        return $localize`:@@store.catalog.sort-price-desc:السعر: من الأعلى`;
      default:
        return $localize`:@@store.catalog.sort-featured:المميّزة`;
    }
  }

  protected onSort(value: string): void {
    void this.router.navigate([], { queryParams: { sort: value === 'featured' ? null : value, page: null }, queryParamsHandling: 'merge' });
  }
}
