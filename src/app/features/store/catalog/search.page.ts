import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { valueOf } from '../../../core/http/resource-value';
import { pageCount } from '../../../core/api/paged';
import { SeoService } from '../../../core/seo/seo.service';
import { ProductCard } from '../../../shared/ui/product-card/product-card';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { CatalogData, liveMap, pageOf, storeItems } from './catalog.data';

/**
 * `/search?q=` (FR-S03): courses and books matching the query; the API normalises Arabic spelling variants.
 * Client-rendered, noindex.
 */
@Component({
  selector: 'ta-search-page',
  imports: [RouterLink, ProductCard, ResourceState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph">
      <div class="wrap">
        <h1 i18n="@@store.search.title">البحث في المتجر</h1>
        <form class="sform" role="search" (submit)="submit($event, box)">
          <label class="visually-hidden" for="search-q" i18n="@@store.layout.search-label">ابحث في المتجر</label>
          <input #box id="search-q" type="search" name="q" [value]="query()" placeholder="ابحث عن دورة أو كتاب…" i18n-placeholder="@@store.layout.search-placeholder" />
          <button type="submit" i18n="@@store.layout.search-submit">بحث</button>
        </form>
      </div>
    </div>
    <section class="list" aria-labelledby="results-h">
      <div class="wrap">
        @if (query()) {
          <h2 id="results-h" class="count" aria-live="polite" i18n="@@store.search.results">نتائج «{{ query() }}»: {{ total() }}</h2>
          <ta-resource-state [loading]="list.isLoading() && !list.hasValue()" [error]="!!list.error()" (retry)="list.reload()">
            @if (items().length > 0) {
              <ul class="cards c3">
                @for (p of items(); track p.id) {
                  <li><ta-product-card [product]="p" [live]="liveBySlug().get(p.slug)" /></li>
                }
              </ul>
              @if (pages() > 1) {
                <nav class="pager" aria-label="ترقيم الصفحات" i18n-aria-label="@@store.ui.data-table-pager-label">
                  @for (n of pageNumbers(); track n) {
                    @if (n === pageValue()) {
                      <span aria-current="page">{{ n }}</span>
                    } @else {
                      <a routerLink="/search" [queryParams]="{ page: n === 1 ? null : n }" queryParamsHandling="merge">{{ n }}</a>
                    }
                  }
                </nav>
              }
            } @else {
              <div class="empty">
                <h3 i18n="@@store.catalog.empty-title">لا توجد نتائج</h3>
                <p i18n="@@store.search.empty-lede">جرّب كلمة أخرى، أو تصفّح الدورات والكتب.</p>
                <p class="links">
                  <a routerLink="/courses" i18n="@@store.layout.nav-courses">الدورات</a>
                  <a routerLink="/books" i18n="@@store.layout.nav-books">الكتب</a>
                </p>
              </div>
            }
          </ta-resource-state>
        } @else {
          <h2 id="results-h" class="visually-hidden" i18n="@@store.search.title">البحث في المتجر</h2>
          <p class="hint" i18n="@@store.search.hint">اكتب اسم دورة أو كتاب أو موضوعًا ثم اضغط «بحث».</p>
        }
      </div>
    </section>
  `,
  styles: `
    .sform {
      display: flex;
      gap: 8px;
      margin-block-start: 20px;
      max-inline-size: 640px;
    }
    .sform input {
      flex: 1;
      min-inline-size: 0;
      font: inherit;
      min-block-size: 48px;
      padding-inline: 18px;
      border-radius: var(--rp);
      border: 1px solid var(--c-border);
      background: var(--c-surface);
      color: var(--c-text);
    }
    .sform button {
      font: inherit;
      font-weight: 600;
      min-block-size: 48px;
      padding-inline: 22px;
      border: 0;
      border-radius: var(--rp);
      background: var(--c-brand-strong);
      color: var(--c-on-brand);
      cursor: pointer;
    }
    .list {
      padding-block: 36px 72px;
    }
    .count {
      font-size: 1.1rem;
      font-weight: 500;
      margin-block: 0 24px;
    }
    .hint {
      color: var(--c-muted);
    }
    .links {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .links a {
      color: var(--c-link);
      min-block-size: 44px;
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class SearchPage {
  private readonly data = inject(CatalogData);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  readonly q = input<string>();
  readonly page = input<string>();
  protected readonly query = computed(() => (this.q() ?? '').trim());
  protected readonly pageValue = computed(() => pageOf(this.page()));

  protected readonly list = this.data.listResource(() => (this.query() ? { q: this.query(), page: this.pageValue() } : undefined));
  protected readonly items = computed(() => storeItems(valueOf(this.list)));
  protected readonly total = computed(() => this.items().length === 0 ? 0 : Number(valueOf(this.list)?.total ?? 0));
  protected readonly live = this.data.liveResource(() => this.items().map((p) => p.slug));
  protected readonly liveBySlug = computed(() => liveMap(this.live.value()));
  protected readonly pages = computed(() => pageCount(valueOf(this.list)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));

  constructor() {
    effect(() => {
      this.seo.set({
        title: $localize`:@@store.search.title:البحث في المتجر`,
        description: $localize`:@@store.search.hint:اكتب اسم دورة أو كتاب أو موضوعًا ثم اضغط «بحث».`,
        path: '/search',
        noindex: true,
      });
    });
  }

  protected submit(event: Event, box: HTMLInputElement): void {
    event.preventDefault();
    const q = box.value.trim();
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }
}
