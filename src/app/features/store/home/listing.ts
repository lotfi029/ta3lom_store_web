import { CATALOG_SORTS, type CatalogSort } from '../../../core/api/api.types';
import { westernDigits } from '../../../core/i18n/western-digits';

/** The listing's state, read from the URL (`/?q&category&sort&page`, D-W3, Option C §5). */
export interface ListingQuery {
  q: string;
  category: string;
  sort: CatalogSort;
  page: number;
}

/** Option C §3 row 6: 20 cards per page (4 × 5 on desktop). */
export const PAGE_SIZE = 20;
export const Q_MAX = 100;
/** A category slug the API can know (owner M-5); anything else is dropped before any request. */
export const CATEGORY_SLUG = /^[a-z0-9-]{2,60}$/;

/**
 * Query parameters (strings from the router) → a clean query, BEFORE any API call (owner M-5): `q` trimmed and cut at
 * 100 characters; an unknown `sort` dropped (featured); a `category` that is not a slug dropped; a page that is not a
 * positive integer (Arabic digits accepted) → 1. A page past the end is handled once the total is known (`lastPage`).
 */
export function toQuery(raw: {
  q?: string | null;
  category?: string | null;
  sort?: string | null;
  page?: string | null;
}): ListingQuery {
  const pageText = westernDigits(raw.page ?? '').trim();
  const page = /^\d{1,6}$/.test(pageText) ? Number(pageText) : 1;
  const sort = (CATALOG_SORTS as readonly string[]).includes(raw.sort ?? '')
    ? (raw.sort as CatalogSort)
    : 'featured';
  const category = CATEGORY_SLUG.test(raw.category ?? '') ? (raw.category as string) : '';
  return {
    q: (raw.q ?? '').trim().slice(0, Q_MAX).trim(),
    category,
    sort,
    page: page >= 1 ? page : 1,
  };
}

/** The URL's query params for a state; defaults are left out so every state has one canonical URL. */
export function toParams(q: ListingQuery): Record<string, string | number | null> {
  return {
    q: q.q || null,
    category: q.category || null,
    sort: q.sort === 'featured' ? null : q.sort,
    page: q.page > 1 ? q.page : null,
  };
}

/** True when the raw URL differs from its normalised form (the page then rewrites it with `replaceUrl`). */
export function needsRewrite(
  raw: { q?: string | null; category?: string | null; sort?: string | null; page?: string | null },
  q: ListingQuery,
): boolean {
  const clean = toParams(q);
  const norm = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
  return (['q', 'category', 'sort', 'page'] as const).some((k) => norm(raw[k]) !== norm(clean[k]));
}

/** Pages for a total (at least 1). */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** The page to show: a page past the end becomes the last page (owner M-5), never 0. */
export function lastPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), pageCount(total));
}

/**
 * The page numbers to show: all when there are 7 or fewer, else the first, the last and the current ±1, with `null`
 * standing for a gap ("…").
 */
export function pageWindow(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, current - 1, current, current + 1]);
  const out: (number | null)[] = [];
  for (let n = 1; n <= pages; n++) {
    if (keep.has(n)) out.push(n);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
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
 * listing `/{locale}/`; any page after the first is `noindex, follow` (its project links still count). An unknown
 * category (owner M-5) is noindex.
 */
export function listingSeo(
  q: ListingQuery,
  unknownCategory = false,
): { path: '/'; noindex: boolean; follow: boolean } {
  if (q.q || unknownCategory) return { path: '/', noindex: true, follow: false };
  if (q.page > 1) return { path: '/', noindex: true, follow: true };
  return { path: '/', noindex: false, follow: false };
}
