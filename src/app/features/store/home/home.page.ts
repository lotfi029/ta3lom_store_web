import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService, siteName } from '../../../core/seo/seo.service';
import {
  AccordionHero,
  type AccordionHeroItem,
} from '../../../shared/ui/accordion-hero/accordion-hero';
import { Icon } from '../../../shared/ui/icon/icon';
import { ProductCard } from '../../../shared/ui/product-card/product-card';
import { HomeData } from './home.data';

/** Store home (FR-S01, r4): hero + search + featured accordion, the two catalogues, categories, courses, books. */
@Component({
  selector: 'ta-home-page',
  imports: [RouterLink, AccordionHero, Icon, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  protected readonly data = inject(HomeData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  protected readonly accordion = computed<AccordionHeroItem[]>(() =>
    this.data.featured().map((p) => ({
      id: p.id,
      href: `/p/${p.slug}`,
      label: this.i18n.pick(p.titleAr, p.titleEn),
      summary: `${p.type === 'course' ? $localize`:@@store.product.type-course:دورة` : $localize`:@@store.product.type-book:كتاب`} · ${this.i18n.pick(p.summaryAr, p.summaryEn)}`,
      cover: p.cover,
      shape: p.type === 'book' ? 'book' : 'tile',
    })),
  );

  constructor() {
    refreshAfterHydration(this.data.home, this.data.categories);
    effect(() => {
      const items = [...this.data.courses(), ...this.data.books()];
      this.seo.set({
        description: $localize`:@@store.home.seo-description:دورات وكتب جمعية التعلم الإلكتروني: تسجيل فوري في الدورات، وكتب مطبوعة ورقمية.`,
        path: '/',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: siteName(),
            url: this.seo.url(this.i18n.locale, '/'),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: items.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: this.seo.url(this.i18n.locale, `/p/${p.slug}`),
            })),
          },
        ],
      });
    });
  }

  protected search(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const q = input.value.trim();
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }
}
