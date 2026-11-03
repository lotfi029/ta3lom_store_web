import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Category, CatalogSort } from '../../../core/api/api.types';
import { CATALOG_SORTS } from '../../../core/api/api.types';
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { QuickDonate } from '../../../core/ui/quick-donate.service';
import { type JsonLd, SeoService, siteName } from '../../../core/seo/seo.service';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { QuickDonateForm } from '../quick-donate/quick-donate-form';
import { CategoryTabs } from './category-tabs';
import { HomeBanner, bannerSlides } from './home-banner';
import { HomeData } from './home.data';
import {
  type ListingQuery,
  lastPage,
  listingSeo,
  needsRewrite,
  pageWindow,
  toParams,
  toQuery,
} from './listing';
import { ProjectCard } from './project-card';
import { TrustRow } from './trust-row';

/** "{n} مشروعًا" with the right Arabic plural form (PluralRules), English one/other. */
export function projectCount(n: number, locale: 'ar' | 'en'): string {
  switch (new Intl.PluralRules(locale).select(n)) {
    case 'zero':
      return $localize`:@@store.home.count-zero:لا توجد مشاريع`;
    case 'one':
      return $localize`:@@store.home.count-one:مشروع واحد`;
    case 'two':
      return $localize`:@@store.home.count-two:مشروعان`;
    case 'few':
      return $localize`:@@store.home.count-few:${n}:n: مشاريع`;
    case 'many':
      return $localize`:@@store.home.count-many:${n}:n: مشروعًا`;
    default:
      return $localize`:@@store.home.count-other:${n}:n: مشروع`;
  }
}

/**
 * `/{locale}/` — Option C "المتجر أولاً" (docs/r5/home-option-c-spec.md §3, §5): category tabs, banner (featured)
 * + inline quick donate, filter bar ("{total} مشروعًا" + sort), the grid (20 per page) and numbered pagination. The URL
 * is the state (`?q&category&sort&page`), normalised before any request (owner M-5); a change of tab, sort, page or
 * search scrolls to the filter bar, focuses the results heading and announces the count (owner M-6). Prerendered
 * without a query; refreshed after hydration. SEO per C-4; JSON-LD `NGO` + `ItemList` of the shown page.
 */
@Component({
  selector: 'ta-home-page',
  imports: [
    RouterLink,
    ResourceState,
    ProjectCard,
    CategoryTabs,
    HomeBanner,
    QuickDonateForm,
    TrustRow,
  ],
  providers: [HomeData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  protected readonly data = inject(HomeData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  protected readonly quick = inject(QuickDonate);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly q = input<string>();
  readonly category = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  private readonly raw = computed(() => ({
    q: this.q(),
    category: this.category(),
    sort: this.sort(),
    page: this.page(),
  }));
  protected readonly query = computed(() => toQuery(this.raw()));
  protected readonly sorts = CATALOG_SORTS;
  protected readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly activeCategory = computed(
    () => this.data.categoryList().find((c) => c.slug === this.query().category) ?? null,
  );
  /** M-5: a well-formed slug the API does not list (inactive or never existed). */
  protected readonly unknownCategory = computed(
    () => !!this.query().category && this.data.hasCategories() && !this.activeCategory(),
  );
  protected readonly pageNumbers = computed(() => pageWindow(this.query().page, this.data.pages()));
  protected readonly hasBanner = computed(() => bannerSlides(this.data.featured()).length > 0);
  protected readonly showQuick = computed(
    () => this.quick.available() && this.data.giftCategories().length > 0,
  );
  protected readonly countText = computed(() => projectCount(this.data.total(), this.i18n.locale));
  protected readonly announce = signal('');

  private readonly fbar = viewChild<ElementRef<HTMLElement>>('fbar');
  private lastKey: string | null = null;
  private pendingFocus = false;

  constructor() {
    refreshAfterHydration(this.data.home, this.data.listing, this.data.categories);
    effect(() => {
      const q = this.query();
      untracked(() => this.data.query.set(q));
    });
    // M-5: rewrite a URL that is not in its clean form (replaceUrl, browser only — the prerender has no query).
    effect(() => {
      const raw = this.raw();
      const q = this.query();
      if (!this.browser || !needsRewrite(raw, q)) return;
      untracked(() => this.replaceQuery(q));
    });
    // M-5: a page past the end → the last page.
    effect(() => {
      if (
        !this.browser ||
        !this.data.hasListing() ||
        this.data.listing.isLoading() ||
        this.data.stale()
      )
        return;
      const q = this.query();
      const page = lastPage(q.page, this.data.total());
      if (page !== q.page) untracked(() => this.replaceQuery({ ...q, page }));
    });
    // M-4: the quick-donate entry points follow the categories that take general gifts.
    effect(() => {
      if (!this.data.hasCategories()) return;
      const n = this.data.giftCategories().length;
      untracked(() => this.quick.giftCategoryCount.set(n));
    });
    // M-6: after a change of tab, sort, page or search, once the new page is in: scroll, focus, announce.
    effect(() => {
      const q = this.query();
      const key = `${q.q}|${q.category}|${q.sort}|${q.page}`;
      if (this.lastKey !== null && key !== this.lastKey) this.pendingFocus = true;
      this.lastKey = key;
    });
    effect(() => {
      const ready = this.data.hasListing() && !this.data.listing.isLoading();
      const text = this.countText();
      if (!this.browser || !ready || !this.pendingFocus) return;
      this.pendingFocus = false;
      untracked(() => this.focusResults(text));
    });
    effect(() => {
      const q = this.query();
      const cat = this.activeCategory();
      const unknown = this.unknownCategory();
      const items = this.data.items();
      untracked(() => this.setSeo(q, cat, unknown, items));
    });
  }

  protected categoryName(c: Category): string {
    return this.i18n.pick(c.nameAr, c.nameEn);
  }

  protected cardCategory(slug: string): string {
    const c = this.data.categoryBySlug().get(slug);
    return c ? this.categoryName(c) : '';
  }

  protected sortLabel(s: CatalogSort): string {
    switch (s) {
      case 'newest':
        return $localize`:@@store.listing.sort-newest:الأحدث`;
      case 'title':
        return $localize`:@@store.home.sort-title:الاسم`;
      default:
        return $localize`:@@store.home.sort-featured:المميزة`;
    }
  }

  protected pageLabel(n: number): string {
    return $localize`:@@store.home.page-label:الصفحة ${n}:n:`;
  }

  /** P5: try every home read again after a failed refresh. */
  protected retryAll(): void {
    this.data.home.reload();
    this.data.categories.reload();
    this.data.listing.reload();
  }

  protected onSort(value: string): void {
    void this.router.navigate([], {
      queryParams: { sort: value === 'featured' ? null : value, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private replaceQuery(q: ListingQuery): void {
    void this.router.navigate([], { queryParams: toParams(q), replaceUrl: true });
  }

  private focusResults(text: string): void {
    const bar = this.fbar()?.nativeElement;
    if (!bar) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    bar.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
    bar.querySelector<HTMLElement>('#list-h')?.focus({ preventScroll: true });
    // Re-set so the same count is announced again.
    this.announce.set('');
    setTimeout(() => this.announce.set(text), 50);
  }

  private setSeo(
    q: ListingQuery,
    cat: Category | null,
    unknown: boolean,
    items: readonly { slug: string; titleAr: string; titleEn: string | null }[],
  ): void {
    const rules = listingSeo(q, unknown);
    const site = siteName();
    const ld: JsonLd[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'NGO',
        name: $localize`:@@store.layout.association:جمعية التعلم الإلكتروني`,
        url: 'https://ta3lom.sa',
        sameAs: ['https://ta3lom.sa'],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: cat ? this.categoryName(cat) : site,
        itemListElement: items.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: this.seo.url(this.i18n.locale, `/p/${p.slug}`),
          name: this.i18n.pick(p.titleAr, p.titleEn),
        })),
      },
    ];
    const qText = q.q;
    this.seo.set({
      title: qText
        ? $localize`:@@store.listing.seo-search:نتائج البحث عن «${qText}:q:»`
        : cat
          ? $localize`:@@store.listing.seo-category:مشاريع ${this.categoryName(cat)}:category:`
          : undefined,
      description: $localize`:@@store.home.seo-description:تبرّع لمشاريع جمعية التعلم الإلكتروني أو لتصنيف عام: كفالات، سقيا، طباعة ونشر العلم. تبرّع سريع وآمن بالريال السعودي.`,
      path: rules.path,
      noindex: rules.noindex,
      follow: rules.follow,
      jsonLd: ld,
    });
  }
}
