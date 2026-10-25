import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Category, CatalogSort } from '../../../core/api/api.types';
import { CATALOG_SORTS } from '../../../core/api/api.types';
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { QuickDonate } from '../../../core/ui/quick-donate.service';
import { type JsonLd, SeoService, siteName } from '../../../core/seo/seo.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { HomeData } from './home.data';
import { listingSeo, toQuery } from './listing';
import { ProjectCard } from './project-card';

/**
 * `/{locale}/` — home + listing (D-W3, donations MVP §4): hero, category chips from the API, search, sort
 * (featured | newest | title), the project grid with paging; state in the URL (`?q&category&sort&page`). Prerendered
 * without a query; refreshed after hydration. SEO per C-4; JSON-LD `NGO` + `ItemList`.
 */
@Component({
  selector: 'ta-home-page',
  imports: [RouterLink, Icon, ResourceState, ProjectCard],
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
  private readonly quick = inject(QuickDonate);

  readonly q = input<string>();
  readonly category = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly query = computed(() =>
    toQuery({ q: this.q(), category: this.category(), sort: this.sort(), page: this.page() }),
  );
  protected readonly sorts = CATALOG_SORTS;
  protected readonly activeCategory = computed(
    () => this.data.categoryList().find((c) => c.slug === this.query().category) ?? null,
  );
  protected readonly pageNumbers = computed(() =>
    Array.from({ length: this.data.pages() }, (_, i) => i + 1),
  );
  protected readonly filtered = computed(() => !!this.query().q || !!this.query().category);

  constructor() {
    refreshAfterHydration(this.data.listing, this.data.categories);
    effect(() => {
      const q = this.query();
      untracked(() => this.data.query.set(q));
    });
    effect(() => {
      const q = this.query();
      const cat = this.activeCategory();
      const items = this.data.items();
      untracked(() => this.setSeo(q.q, cat, items));
    });
  }

  protected categoryName(c: Category): string {
    return this.i18n.pick(c.nameAr, c.nameEn);
  }

  protected sortLabel(s: CatalogSort): string {
    switch (s) {
      case 'newest':
        return $localize`:@@store.listing.sort-newest:الأحدث`;
      case 'title':
        return $localize`:@@store.listing.sort-title:حسب الاسم`;
      default:
        return $localize`:@@store.listing.sort-featured:المميّزة`;
    }
  }

  protected openQuick(event: Event): void {
    this.quick.show(event.currentTarget);
  }

  protected search(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const q = input.value.trim();
    void this.router.navigate([], {
      queryParams: { q: q || null, page: null },
      queryParamsHandling: 'merge',
      fragment: 'projects',
    });
  }

  protected onSort(value: string): void {
    void this.router.navigate([], {
      queryParams: { sort: value === 'featured' ? null : value, page: null },
      queryParamsHandling: 'merge',
      fragment: 'projects',
    });
  }

  private setSeo(
    q: string,
    cat: Category | null,
    items: readonly { slug: string; titleAr: string; titleEn: string | null }[],
  ): void {
    const rules = listingSeo(this.query());
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
    this.seo.set({
      title: q
        ? $localize`:@@store.listing.seo-search:نتائج البحث عن «${q}:q:»`
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
