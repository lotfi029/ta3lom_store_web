import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../../core/seo/seo.service';

/**
 * TEMPORARY (W-M0 only): a screen that is rebuilt for the R5 donations API in a later phase of this PR. Removed once
 * every route has its real page (W-M5).
 */
@Component({
  selector: 'ta-placeholder-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap ph-page">
      <h1>{{ title }}</h1>
      <p i18n="@@store.placeholder.lede">هذه الصفحة قيد التحديث لمتجر التبرعات.</p>
      <a routerLink="/" i18n="@@store.not-found.home">الصفحة الرئيسية للمتجر</a>
    </section>
  `,
  styles: `
    .ph-page {
      padding-block: var(--space-10);
    }
    .ph-page a {
      color: var(--c-link);
    }
  `,
})
export class PlaceholderPage {
  protected readonly title: string =
    inject(ActivatedRoute).snapshot.data['title'] ??
    $localize`:@@store.placeholder.title:متجر التبرعات`;

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({ title: this.title, description: this.title, path: '/', noindex: true });
  }
}
