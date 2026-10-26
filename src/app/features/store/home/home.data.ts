import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Category, ProjectCard, ProjectPage } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { valueOf } from '../../../core/http/resource-value';
import { type ListingQuery, PAGE_SIZE, listingParams } from './listing';

/**
 * Home = listing (D-W3): `GET /v1/catalog/projects` for the URL's query and `GET /v1/catalog/categories` for the chips
 * (non-negotiable #12). Read during prerender (transfer state) and refreshed after hydration by the page.
 */
@Injectable()
export class HomeData {
  private readonly api = inject(STORE_API_URL);
  readonly query = signal<ListingQuery>({ q: '', category: '', sort: 'featured', page: 1 });

  readonly listing = httpResource<ProjectPage>(() => ({
    url: `${this.api}/catalog/projects`,
    params: listingParams(this.query()),
  }));
  readonly categories = httpResource<Category[]>(() => `${this.api}/catalog/categories`);

  private readonly page = computed(() => valueOf(this.listing));
  /** The cards in the API's order (U-2). */
  readonly items = computed<readonly ProjectCard[]>(() => this.page()?.items ?? []);
  readonly total = computed(() => toInt(this.page()?.total));
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly categoryList = computed<readonly Category[]>(() => valueOf(this.categories) ?? []);
}
