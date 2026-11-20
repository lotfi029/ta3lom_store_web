import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Category } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';

/**
 * Category tab bar (Option C §3 row 3): "كل المشاريع" + every active category from `GET /v1/catalog/categories`
 * (non-negotiable #12). Tabs are LINKS, not `role=tab` — they navigate: each sets `?category=` (none for "all"),
 * resets `page` and keeps `q` and `sort`. The active one carries `aria-current="page"` and the 3 px accent underline.
 * Only the bar scrolls sideways on narrow screens, never the page.
 */
@Component({
  selector: 'ta-category-tabs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" aria-label="التصنيفات" i18n-aria-label="@@store.listing.categories-label">
      <div class="track">
        <a
          class="tab"
          routerLink="/"
          [queryParams]="{ category: null, page: null }"
          queryParamsHandling="merge"
          [attr.aria-current]="!active() ? 'page' : null"
          i18n="@@store.home.tab-all"
          >كل المشاريع</a
        >
        @for (c of categories(); track c.slug) {
          <a
            class="tab"
            routerLink="/"
            [queryParams]="{ category: c.slug, page: null }"
            queryParamsHandling="merge"
            [attr.aria-current]="active() === c.slug ? 'page' : null"
            >{{ i18n.pick(c.nameAr, c.nameEn) }}</a
          >
        }
      </div>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      background: var(--c-surface);
      border-block-end: 1px solid var(--c-border);
    }
    .tabs {
      max-width: 1200px;
      margin-inline: auto;
      padding-inline: var(--space-6);
    }
    .track {
      display: flex;
      gap: var(--space-1);
      padding-block: var(--space-2);
      overflow-x: auto;
      scrollbar-width: thin;
      overscroll-behavior-x: contain;
    }
    /* Option C: liquid pills — the active tab is a tint pill (was a 3 px underline). */
    .tab {
      flex: none;
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      padding-inline: var(--space-4);
      border-radius: var(--rp);
      color: var(--c-text-2);
      text-decoration: none;
      font-size: 0.95rem;
      white-space: nowrap;
      transition:
        color var(--dur-1),
        background-color var(--dur-1);
    }
    .tab:hover {
      color: var(--c-text);
      background: var(--c-surface-2);
    }
    .tab[aria-current='page'] {
      color: var(--c-accent-strong);
      font-weight: 600;
      background: var(--c-tint);
    }
    .tab:focus-visible {
      outline-offset: -2px;
    }
    @media (width < 600px) {
      .tabs {
        padding-inline: var(--space-2);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .tab {
        transition: none;
      }
    }
  `,
})
export class CategoryTabs {
  protected readonly i18n = inject(I18nService);
  readonly categories = input.required<readonly Category[]>();
  /** The active category slug ('' = all projects). */
  readonly active = input<string>('');
}
