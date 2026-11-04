import { HttpContext, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Category, HomeResponse, ProjectCard, ProjectPage } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { SILENT } from '../../../core/http/error-toast.interceptor';
import { hydrationSnapshot } from '../../../core/http/hydration-snapshot';
import { sameJson } from '../../../core/http/same-json';
import { stickyValue } from '../../../core/http/sticky-value';
import { type ListingQuery, listingParams, pageCount } from './listing';

/**
 * Option C home (spec §3): `GET /v1/catalog/home` (featured → banner), `GET /v1/catalog/categories` (tab bar, card
 * category names, quick-donate categories — non-negotiable #12) and `GET /v1/catalog/projects` for the URL's query.
 * Read during prerender (transfer state) and refreshed after hydration by the page. The reads are SILENT (no error
 * toast): the page shows its own states, and when the refresh fails it keeps the prerendered data with a notice (P5).
 */
const silent = () => new HttpContext().set(SILENT, true);
@Injectable()
export class HomeData {
  private readonly api = inject(STORE_API_URL);
  readonly query = signal<ListingQuery>({ q: '', category: '', sort: 'featured', page: 1 });

  readonly home = httpResource<HomeResponse>(
    () => ({ url: `${this.api}/catalog/home`, context: silent() }),
    { equal: sameJson },
  );
  readonly listing = httpResource<ProjectPage>(
    () => ({
      url: `${this.api}/catalog/projects`,
      params: listingParams(this.query()),
      context: silent(),
    }),
    { equal: sameJson },
  );
  readonly categories = httpResource<Category[]>(
    () => ({ url: `${this.api}/catalog/categories`, context: silent() }),
    { equal: sameJson },
  );

  /** The prerendered answers stand in while hydrating (core/http/hydration-snapshot), so the DOM matches. */
  private readonly listingSnap = hydrationSnapshot(this.listing, 'home.listing', () =>
    JSON.stringify(this.query()),
  );
  private readonly homeSnap = hydrationSnapshot(this.home, 'home.home', () => '');
  private readonly categoriesSnap = hydrationSnapshot(this.categories, 'home.categories', () => '');

  /** P5: the last good answers while a refresh of the same request fails (the prerendered data stays on screen). */
  private readonly page = stickyValue(this.listingSnap, () => JSON.stringify(this.query()));
  private readonly homeValue = stickyValue(this.homeSnap);
  private readonly categoriesValue = stickyValue(this.categoriesSnap);
  /** The listing has data to show (fresh, or kept after a failed refresh). */
  readonly hasListing = computed(() => this.page() !== undefined);
  readonly hasCategories = computed(() => this.categoriesValue() !== undefined);
  /** A refresh failed and older data is on screen → "تعذّر تحديث البيانات". */
  readonly stale = computed(
    () =>
      (!!this.listing.error() && this.hasListing()) ||
      (!!this.home.error() && this.homeValue() !== undefined) ||
      (!!this.categories.error() && this.hasCategories()),
  );
  /** The cards in the API's order (U-2). */
  readonly items = computed<readonly ProjectCard[]>(() => this.page()?.items ?? []);
  readonly total = computed(() => toInt(this.page()?.total));
  readonly pages = computed(() => pageCount(this.total()));
  readonly categoryList = computed<readonly Category[]>(() => this.categoriesValue() ?? []);
  readonly featured = computed<readonly ProjectCard[]>(() => this.homeValue()?.featured ?? []);
  /** Categories that accept general gifts, in the API order (`sort`) — the inline quick donate (C-3). */
  readonly giftCategories = computed(() =>
    this.categoryList().filter((c) => c.acceptsGeneralGifts),
  );
  /** Category slug → display names, for the cards (no request per card). */
  readonly categoryBySlug = computed(
    () => new Map(this.categoryList().map((c) => [c.slug, c] as const)),
  );
}
