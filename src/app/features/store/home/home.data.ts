import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import type { Category, HomeResponse, LiveFigures, LiveItem } from '../../../core/api/api.types';
import { isStoreProduct } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { STORE_API_URL } from '../../../core/api/store-api-url';

/**
 * Store home (#1 home, #2 categories, #5 live). r4: only `featured`, `courses` and `books` are read — the pre-r4 API's
 * causes, sponsorable, impact and general-fund blocks are ignored, and any non course/book card is dropped.
 */
@Injectable({ providedIn: 'root' })
export class HomeData {
  private readonly api = inject(STORE_API_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly home = httpResource<HomeResponse>(() => `${this.api}/catalog/home`);
  readonly categories = httpResource<Category[]>(() => `${this.api}/catalog/categories`);
  readonly catList = computed(() => valueOf(this.categories) ?? []);

  readonly featured = computed(() =>
    (valueOf(this.home)?.featured ?? []).filter(isStoreProduct).slice(0, 5),
  );
  readonly courses = computed(() =>
    (valueOf(this.home)?.courses ?? []).filter(isStoreProduct).slice(0, 6),
  );
  readonly books = computed(() =>
    (valueOf(this.home)?.books ?? []).filter(isStoreProduct).slice(0, 4),
  );

  private readonly liveRes = httpResource<LiveFigures>(() => {
    const slugs = [...this.courses(), ...this.books()].map((p) => p.slug);
    return this.browser && slugs.length
      ? { url: `${this.api}/catalog/live`, params: { slugs: slugs.join(',') } }
      : undefined;
  });
  readonly live = computed(
    () => new Map<string, LiveItem>((valueOf(this.liveRes)?.items ?? []).map((i) => [i.slug, i])),
  );
}
