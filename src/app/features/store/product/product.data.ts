import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import type {
  BookFormat,
  Enrolment,
  LiveFigures,
  ProductDetail,
  ProductPage,
} from '../../../core/api/api.types';
import { isStoreProduct, toInt } from '../../../core/api/api.types';
import { valueOf } from '../../../core/http/resource-value';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { StoreAuth } from '../../../core/auth/store-auth';

/**
 * One product page (#4 detail, #5 live). Provided on the page component, so each visit has its own instance.
 *   - `product`: rendered at build time and reloaded after hydration (titles, curriculum, formats).
 *   - `live`: browser only — price, compare-at and print stock never come from the build snapshot (FR-S07).
 *   - `related`: the full cards of the related slugs, fetched when the section scrolls into view (`@defer`).
 */
@Injectable()
export class ProductData {
  private readonly api = inject(STORE_API_URL);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly slug = signal('');
  readonly product = httpResource<ProductDetail>(() =>
    this.slug() ? `${this.api}/catalog/products/${encodeURIComponent(this.slug())}` : undefined,
  );
  private readonly liveRes = httpResource<LiveFigures>(() =>
    this.browser && this.slug()
      ? { url: `${this.api}/catalog/live`, params: { slugs: this.slug() } }
      : undefined,
  );
  readonly live = computed(
    () => valueOf(this.liveRes)?.items.find((i) => i.slug === this.slug()) ?? null,
  );

  /** The product exists, is published and is a course or a book (r4). */
  readonly value = computed(() => {
    const p = valueOf(this.product);
    return p && isStoreProduct(p) ? p : null;
  });
  readonly notFound = computed(() => {
    const e = this.product.error();
    const p = valueOf(this.product);
    return (e instanceof HttpErrorResponse && e.status === 404) || (!!p && !isStoreProduct(p));
  });

  readonly coursePrice = computed(() => this.live()?.price ?? this.value()?.course?.price ?? null);
  readonly courseCompareAt = computed(
    () => this.live()?.compareAtPrice ?? this.value()?.course?.compareAtPrice ?? null,
  );

  /** Book formats with the live price and stock merged in (print `available`; digital is unlimited). */
  readonly formats = computed<BookFormat[]>(() => {
    const formats = this.value()?.book?.formats ?? [];
    const live = this.live()?.formats ?? [];
    // Print first, as in the prototype; it is also the pre-selected format when in stock.
    return [...formats]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'print' ? -1 : 1))
      .map((f) => {
        const l = live.find((x) => x.kind === f.kind);
        return l ? { ...f, price: l.price, available: l.available } : f;
      });
  });

  /**
   * Ownership (RUL-13): a signed-in customer's enrolments, course pages only — never part of the public live call.
   * The API stays the final guard (`cart.course_owned`).
   */
  private readonly auth = inject(StoreAuth);
  private readonly enrolments = httpResource<Enrolment[]>(() =>
    this.browser && this.auth.isSignedIn() && this.value()?.type === 'course'
      ? `${this.api}/me/enrolments`
      : undefined,
  );
  readonly owned = computed(() =>
    (valueOf(this.enrolments) ?? []).some(
      (e) => e.product.slug === this.slug() && e.status !== 'revoked' && e.status !== 'expired',
    ),
  );

  readonly relatedWanted = signal(false);
  private readonly relatedList = httpResource<ProductPage>(() => {
    const p = this.value();
    return this.browser && this.relatedWanted() && p && p.related.length
      ? { url: `${this.api}/catalog/products`, params: { type: p.type, pageSize: '100' } }
      : undefined;
  });
  readonly related = computed(() => {
    const slugs = new Set((this.value()?.related ?? []).map((r) => r.slug));
    return (valueOf(this.relatedList)?.items ?? [])
      .filter((c) => slugs.has(c.slug) && isStoreProduct(c))
      .slice(0, 3);
  });
  readonly relatedResource = this.relatedList;

  reload(): void {
    this.product.reload();
  }
}

/** Print stock that can still be bought (`available`, print only); null = unlimited (digital). */
export function printAvailable(f: BookFormat): number | null {
  return f.kind === 'print' ? toInt(f.available) : null;
}
