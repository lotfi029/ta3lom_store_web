import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n';

export interface Crumb {
  label: string;
  /** Omitted on the last crumb — the current page is not a link to itself. */
  path?: string;
}

/**
 * The prototype's `.ph` page-head band (its `pageHead()`, line 1003): a full-bleed grey band
 * carrying breadcrumbs, the page's single h1 and an optional lede.
 *
 * Full-bleed is why this owns its own `.wrap` rather than being dropped inside the page's: the
 * band's background has to run the full width of the viewport while its text stays on the same
 * 1200px measure as the content below it.
 *
 * Two deliberate departures from the prototype's markup, neither of which changes how it looks:
 * the breadcrumb trail is a real `<nav>` + `<ol>` rather than divs and spans, and the current
 * page carries `aria-current="page"`. The prototype renders the separators as text nodes; here
 * they are CSS `::before` content marked `aria-hidden`, so a screen reader hears the trail
 * rather than a run of slashes.
 *
 * Currently used by the six /about routes. It is deliberately generic — the prototype puts this
 * band on every public page, and rolling it out further is a per-template one-liner.
 */
@Component({
  selector: 'ta-page-head',
  imports: [RouterLink],
  templateUrl: './page-head.html',
  styleUrl: './page-head.css',
})
export class PageHead {
  readonly heading = input.required<string>();
  readonly lede = input<string>();
  readonly crumbs = input<Crumb[]>([]);
  private readonly i18n = inject(I18nService);

  /** Through pick(), not a bare Arabic default: an unlocalised default would announce the
   *  breadcrumb landmark as 'مسار التنقل' in the English build, since no caller overrides it. */
  readonly crumbsLabel = input(this.i18n.pick('مسار التنقل', 'Breadcrumb'));
}
