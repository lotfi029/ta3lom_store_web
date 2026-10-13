import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CourseModule, ProductDetail } from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { StoreConfig } from '../../../core/api/store-config';
import { problemMessage } from '../../../core/api/problem-message';
import { CartStore } from '../../../core/cart/cart-store';
import { ToastService } from '../../../core/ui/toast.service';
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { type JsonLd, SeoService, siteName, breadcrumbJsonLd } from '../../../core/seo/seo.service';
import { environment } from '../../../../environments/environment';
import { Cover } from '../../../shared/ui/cover/cover';
import { BuyBox, type BuyRequest } from './buy-box';
import { ProductData } from './product.data';
import { RelatedList } from './related-list';
import { ShareSheet } from './share-sheet';

/**
 * `/p/:slug` (FR-S04/S05/S09): a course or a book. Prerendered for every slug known at build time; a product published
 * later renders through the client fallback. Live price and stock replace the build-time figures in place (FR-S07).
 */
@Component({
  selector: 'ta-product-page',
  imports: [RouterLink, Cover, BuyBox, ShareSheet, RelatedList],
  providers: [ProductData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product.page.html',
  styleUrl: './product.page.css',
})
export class ProductPage {
  protected readonly data = inject(ProductData);
  protected readonly config = inject(StoreConfig);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly slug = input.required<string>();
  private readonly cart = inject(CartStore);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly buyError = signal<string | null>(null);

  protected readonly p = this.data.value;
  protected readonly title = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.titleAr, p.titleEn) : '';
  });
  protected readonly summary = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.summaryAr, p.summaryEn) : '';
  });
  /** The body is plain text from the API: paragraphs split on blank lines, rendered as text (never as HTML). */
  protected readonly bodyParagraphs = computed(() => {
    const p = this.p();
    const body = p ? this.i18n.pick(p.bodyAr ?? '', p.bodyEn) : '';
    return body
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  protected readonly isCourse = computed(() => this.p()?.type === 'course');
  protected readonly typePath = computed(() => (this.isCourse() ? '/courses' : '/books'));
  protected readonly typeLabel = computed(() =>
    this.isCourse()
      ? $localize`:@@store.layout.nav-courses:الدورات`
      : $localize`:@@store.layout.nav-books:الكتب`,
  );
  protected readonly category = computed(() => {
    const c = this.p()?.category;
    return c ? this.i18n.pick(c.nameAr, c.nameEn) : null;
  });
  protected readonly hours = computed(() =>
    Math.round(toInt(this.p()?.course?.durationMinutes) / 60),
  );
  protected readonly canonical = computed(() =>
    this.seo.url(this.i18n.locale, `/p/${this.slug()}`),
  );

  constructor() {
    effect(() => this.data.slug.set(this.slug()));
    refreshAfterHydration(this.data.product);
    effect(() => {
      if (this.data.notFound()) {
        this.seo.set({
          title: $localize`:@@store.product.unavailable-title:هذا المنتج غير متاح`,
          description: $localize`:@@store.product.unavailable-lede:ربما أُرشف هذا المنتج أو لم يُنشر بعد.`,
          path: `/p/${this.slug()}`,
          noindex: true,
        });
        return;
      }
      const p = this.p();
      if (p) this.setSeo(p);
    });
  }

  protected moduleTitle(m: CourseModule): string {
    return this.i18n.pick(m.titleAr, m.titleEn);
  }

  /** 2520 → "42:00", 4200 → "1:10:00". */
  protected duration(seconds: number | string): string {
    const s = toInt(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0');
    return h
      ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
      : `${mm}:${String(sec).padStart(2, '0')}`;
  }

  /** The instructor's initial for the avatar, skipping a title such as "أ." or "د.". */
  protected initial(name: string): string {
    return name.replace(/^(أ\.|د\.|م\.|Dr\.|Mr\.|Ms\.)\s*/u, '').charAt(0);
  }

  protected n(value: number | string | null | undefined): string {
    return this.i18n.formatNumber(toInt(value));
  }

  protected async onAdd(request: BuyRequest): Promise<void> {
    if (await this.addToCart(request)) {
      this.toast.show($localize`:@@store.cart.added:أُضيف إلى السلة`, 'success', {
        label: $localize`:@@store.cart.view:عرض السلة`,
        path: '/cart',
      });
    }
  }

  protected async onBuyNow(request: BuyRequest): Promise<void> {
    if (await this.addToCart(request)) await this.router.navigateByUrl('/checkout');
  }

  private async addToCart(request: BuyRequest): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.buyError.set(null);
    try {
      const ok = await this.cart.add(request);
      if (!ok) {
        const p = this.cart.lastProblem();
        // RUL-13/RUL-14: a course already in the cart is not an error for the buyer — take them to the cart.
        if (p?.code === 'cart.duplicate_course') {
          this.toast.show(problemMessage(p), 'info', {
            label: $localize`:@@store.cart.view:عرض السلة`,
            path: '/cart',
          });
          return false;
        }
        this.buyError.set(p ? problemMessage(p) : null);
      }
      return ok;
    } finally {
      this.busy.set(false);
    }
  }

  protected goToCourse(): void {
    void this.router.navigateByUrl('/account/courses');
  }

  private setSeo(p: ProductDetail): void {
    const locale = this.i18n.locale;
    const title = this.i18n.pick(p.seo.titleAr ?? p.titleAr, p.seo.titleEn ?? p.titleEn);
    const description = this.i18n.pick(p.seo.descAr ?? p.summaryAr, p.seo.descEn ?? p.summaryEn);
    const url = this.canonical();
    const org = { '@type': 'Organization', name: siteName(), url: environment.mainSiteUrl };
    const ld: JsonLd =
      p.type === 'course'
        ? {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: title,
            description,
            url,
            inLanguage: 'ar',
            provider: org,
            ...(p.cover ? { image: p.cover.url } : {}),
            hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online' },
            offers: {
              '@type': 'Offer',
              price: p.course?.price,
              priceCurrency: 'SAR',
              category: 'Paid',
              availability: 'https://schema.org/InStock',
              url,
            },
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: title,
            description,
            url,
            inLanguage: 'ar',
            author: {
              '@type': 'Organization',
              name: this.i18n.pick(p.book?.authorAr ?? '', p.book?.authorEn),
            },
            publisher: org,
            ...(p.cover ? { image: p.cover.url } : {}),
            ...(p.book?.pages ? { numberOfPages: toInt(p.book.pages) } : {}),
            ...(p.book?.isbn ? { isbn: p.book.isbn } : {}),
            ...(p.book?.publishedYear ? { datePublished: String(p.book.publishedYear) } : {}),
            offers: (p.book?.formats ?? []).map((f) => ({
              '@type': 'Offer',
              price: f.price,
              priceCurrency: 'SAR',
              url,
              availability:
                f.kind === 'print' && toInt(f.available) <= 0
                  ? 'https://schema.org/OutOfStock'
                  : 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Book',
                bookFormat:
                  f.kind === 'print' ? 'https://schema.org/Paperback' : 'https://schema.org/EBook',
              },
            })),
          };
    this.seo.set({
      title,
      description,
      path: `/p/${p.slug}`,
      image: p.cover?.url ?? null,
      ogType: p.type === 'book' ? 'book' : 'website',
      jsonLd: [
        ld,
        breadcrumbJsonLd([
          [$localize`:@@store.layout.nav-home:الرئيسية`, this.seo.url(locale, '/')],
          [this.typeLabel(), this.seo.url(locale, this.typePath())],
          [title, url],
        ]),
      ],
    });
  }
}
