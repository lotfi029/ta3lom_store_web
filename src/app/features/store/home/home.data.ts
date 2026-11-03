import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Category, HomeResponse, ProjectCard, ProjectPage } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { valueOf } from '../../../core/http/resource-value';
import { sameJson } from '../../../core/http/same-json';
import { type ListingQuery, listingParams, pageCount } from './listing';

/**
 * Option C home (spec §3): `GET /v1/catalog/home` (featured → banner), `GET /v1/catalog/categories` (tab bar, card
 * category names, quick-donate categories — non-negotiable #12) and `GET /v1/catalog/projects` for the URL's query.
 * Read during prerender (transfer state) and refreshed after hydration by the page.
 */
@Injectable()
export class HomeData {
  private readonly api = inject(STORE_API_URL);
  readonly query = signal<ListingQuery>({ q: '', category: '', sort: 'featured', page: 1 });

  readonly home = httpResource<HomeResponse>(() => `${this.api}/catalog/home`, { equal: sameJson });
  readonly listing = httpResource<ProjectPage>(
    () => ({
      url: `${this.api}/catalog/projects`,
      params: listingParams(this.query()),
    }),
    { equal: sameJson },
  );
  readonly categories = httpResource<Category[]>(() => `${this.api}/catalog/categories`, {
    equal: sameJson,
  });

  private readonly page = computed(() => valueOf(this.listing));
  /** The cards in the API's order (U-2). */
  readonly items = computed<readonly ProjectCard[]>(() => this.page()?.items ?? []);
  readonly total = computed(() => toInt(this.page()?.total));
  readonly pages = computed(() => pageCount(this.total()));
  readonly categoryList = computed<readonly Category[]>(() => valueOf(this.categories) ?? []);
  readonly featured = computed<readonly ProjectCard[]>(() => valueOf(this.home)?.featured ?? []);
  /** Categories that accept general gifts, in the API order (`sort`) — the inline quick donate (C-3). */
  readonly giftCategories = computed(() =>
    this.categoryList().filter((c) => c.acceptsGeneralGifts),
  );
  /** Category slug → display names, for the cards (no request per card). */
  readonly categoryBySlug = computed(
    () => new Map(this.categoryList().map((c) => [c.slug, c] as const)),
  );
}
