import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Category } from '../../../core/api/api.types';
import { I18nService } from '../../../core/i18n/i18n';

/**
 * Category tab bar (Option C §3 row 3): "كل المشاريع" + every active category from `GET /v1/catalog/categories`
 * (non-negotiable #12). Tabs are LINKS, not `role=tab` — they navigate: each sets `?category=` (none for "all"),
 * resets `page` and keeps `q` and `sort`. The active one carries `aria-current="page"` and is a filled brand pill.
 * Only the bar scrolls sideways on narrow screens, never the page.
 */
@Component({
  selector: 'ta-category-tabs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="tabs glass-strong"
      aria-label="التصنيفات"
      i18n-aria-label="@@store.listing.categories-label"
    >
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
    /* Option D: a floating glass pill bar that overlaps the bottom of the hero (the page places it). */
    :host {
      display: block;
    }
    .tabs {
      border-radius: var(--rp);
      padding-inline: var(--space-2);
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
      color: var(--c-on-brand);
      font-weight: 600;
      background: var(--c-brand-strong);
      box-shadow: inset 0 1px 0 var(--c-liquid-hi);
    }
    .tab:focus-visible {
      outline-offset: -2px;
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
