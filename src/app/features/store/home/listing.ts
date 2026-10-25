import { CATALOG_SORTS, type CatalogSort } from '../../../core/api/api.types';
import { westernDigits } from '../../../core/i18n/western-digits';

/** The listing's state, read from the URL (`/?q&category&sort&page`, D-W3). */
export interface ListingQuery {
  q: string;
  category: string;
  sort: CatalogSort;
  page: number;
}

export const PAGE_SIZE = 12;

/** Query parameters (strings from the router) → a clean query; anything invalid falls back to the default. */
export function toQuery(raw: {
  q?: string | null;
  category?: string | null;
  sort?: string | null;
  page?: string | null;
}): ListingQuery {
  const page = Number.parseInt(westernDigits(raw.page ?? ''), 10);
  const sort = (CATALOG_SORTS as readonly string[]).includes(raw.sort ?? '')
    ? (raw.sort as CatalogSort)
    : 'featured';
  const category = /^[a-z0-9-]{1,60}$/.test(raw.category ?? '') ? (raw.category as string) : '';
  return {
    q: (raw.q ?? '').trim().slice(0, 100),
    category,
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/**
 * The API request params. Defaults are omitted (`sort=featured`), so the default listing has one stable URL — the
 * same one the prerender fetched and the transfer state replays. The API's order is kept as is (U-2: the default order
 * is sort, published_at DESC, id; the client never re-sorts).
 */
export function listingParams(q: ListingQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { page: q.page, pageSize: PAGE_SIZE };
  if (q.q) params['q'] = q.q;
  if (q.category) params['category'] = q.category;
  if (q.sort !== 'featured') params['sort'] = q.sort;
  return params;
}

/**
 * C-4 SEO of a listing URL: a search (`?q=`) is noindex; a category filter is indexable with the canonical on the plain
 * listing `/{locale}/`; any page after the first is `noindex, follow` (its project links still count).
 */
export function listingSeo(q: ListingQuery): { path: '/'; noindex: boolean; follow: boolean } {
  if (q.q) return { path: '/', noindex: true, follow: false };
  if (q.page > 1) return { path: '/', noindex: true, follow: true };
  return { path: '/', noindex: false, follow: false };
}
