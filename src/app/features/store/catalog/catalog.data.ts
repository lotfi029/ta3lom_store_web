import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type { Category, LiveFigures, LiveItem, ProductCard, ProductPage, StoreProductType } from '../../../core/api/api.types';
import { isStoreProduct } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';

export type CatalogSort = 'featured' | 'newest' | 'price_asc' | 'price_desc';
export const CATALOG_SORTS: readonly CatalogSort[] = ['featured', 'newest', 'price_asc', 'price_desc'];
export const PAGE_SIZE = 12;

export interface CatalogQuery {
  type?: StoreProductType;
  category?: string | null;
  sort?: CatalogSort;
  q?: string | null;
  page?: number;
}

/**
 * Catalogue reads (#2 categories, #3 products, #5 live). Content resources are prerendered and reloaded after
 * hydration by the pages; `live` is browser-only so prices and stock never come from the build snapshot (FR-S07).
 * r4: anything that is not a course or a book (a pre-r4 API may still list causes) is dropped here.
 */
@Injectable({ providedIn: 'root' })
export class CatalogData {
  private readonly api = inject(STORE_API_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Must be called in an injection context (a component field initialiser). */
  categoriesResource() {
    return httpResource<Category[]>(() => `${this.api}/catalog/categories`);
  }

  listResource(query: () => CatalogQuery | undefined) {
    return httpResource<ProductPage>(() => {
      const q = query();
      if (!q) return undefined;
      const params: Record<string, string> = { pageSize: String(PAGE_SIZE), page: String(q.page ?? 1) };
      if (q.type) params['type'] = q.type;
      if (q.category) params['category'] = q.category;
      if (q.sort && q.sort !== 'featured') params['sort'] = q.sort;
      if (q.q) params['q'] = q.q;
      return { url: `${this.api}/catalog/products`, params };
    });
  }

  liveResource(slugs: () => string[]) {
    return httpResource<LiveFigures>(() => {
      const s = slugs();
      return this.browser && s.length ? { url: `${this.api}/catalog/live`, params: { slugs: s.slice(0, 50).join(',') } } : undefined;
    });
  }
}

/** Store products of a page, r4 only. */
export function storeItems(page: ProductPage | undefined): ProductCard[] {
  return (page?.items ?? []).filter(isStoreProduct);
}

/** slug → live figures, for `ta-product-card [live]`. */
export function liveMap(live: LiveFigures | undefined) {
  return computedMap(live?.items ?? []);
}
function computedMap(items: LiveItem[]): Map<string, LiveItem> {
  return new Map(items.map((i) => [i.slug, i]));
}

export const sortOf = (v: string | null | undefined): CatalogSort => (CATALOG_SORTS.includes(v as CatalogSort) ? (v as CatalogSort) : 'featured');
export const pageOf = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
};
