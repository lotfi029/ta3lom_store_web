import { HttpErrorResponse } from '@angular/common/http';
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
import { refreshAfterHydration } from '../../../core/http/refresh-after-hydration';
import { I18nService } from '../../../core/i18n/i18n';
import { SeoService, siteName } from '../../../core/seo/seo.service';
import { Image } from '../../../shared/ui/image/image';
import { Markdown } from '../../../shared/ui/markdown/markdown';
import { ResourceState } from '../../../shared/ui/resource-state/resource-state';
import { DonateBox } from '../donate/donate-box';
import type { DonateProject } from '../donate/donate-draft';
import { ProjectData } from '../donate/project.data';
import { ShareSheet } from '../share/share-sheet';
import { projectJsonLd } from './project-seo';

/**
 * `/{locale}/p/{slug}` (W-M2): cover, title, summary, the story (Markdown subset through `<ta-markdown>`, C-5), the
 * donate box (large: options, qty, open amount with presets), share sheet. Prerendered for every slug known at build
 * time and refreshed after hydration (options and amounts are live). An old slug answers `{ redirectTo }` → the page
 * replaces the history entry with the current slug. Only an API 404 shows "not found" (noindex, E-1).
 */
@Component({
  selector: 'ta-project-page',
  imports: [RouterLink, Image, Markdown, ResourceState, DonateBox, ShareSheet],
  providers: [ProjectData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project.page.html',
  styleUrl: './project.page.css',
})
export class ProjectPage {
  protected readonly data = inject(ProjectData);
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly p = this.data.detail;
  protected readonly notFound = computed(() => {
    const e = this.data.resource.error();
    return e instanceof HttpErrorResponse && e.status === 404;
  });
  protected readonly title = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.titleAr, p.titleEn) : '';
  });
  protected readonly summary = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.summaryAr ?? '', p.summaryEn) : '';
  });
  protected readonly body = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.bodyAr ?? '', p.bodyEn) : '';
  });
  protected readonly categoryName = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.category.nameAr, p.category.nameEn) : '';
  });
  protected readonly alt = computed(() => {
    const p = this.p();
    return p ? this.i18n.pick(p.coverAltAr ?? '', p.coverAltEn) || this.title() : '';
  });
  protected readonly canonical = computed(() =>
    this.seo.url(this.i18n.locale, `/p/${this.slug()}`),
  );
  protected readonly donate = computed<DonateProject | null>(() => {
    const p = this.p();
    return p
      ? {
          id: p.id,
          slug: p.slug,
          titleAr: p.titleAr,
          titleEn: p.titleEn,
          allowOpenAmount: p.allowOpenAmount,
          minAmount: p.minAmount,
          options: p.options,
        }
      : null;
  });

  constructor() {
    refreshAfterHydration(this.data.resource);
    effect(() => {
      const s = this.slug();
      untracked(() => this.data.slug.set(s));
    });
    // D-08: an old slug → the current one, replacing the history entry (the old URL never stays in history).
    effect(() => {
      const to = this.data.redirectTo();
      if (to) untracked(() => void this.router.navigate(['/p', to], { replaceUrl: true }));
    });
    effect(() => {
      const p = this.p();
      const gone = this.notFound();
      untracked(() => this.setSeo(p, gone));
    });
  }

  private setSeo(p: ReturnType<typeof this.p>, gone: boolean): void {
    if (gone || !p) {
      this.seo.set({
        title: gone
          ? $localize`:@@store.project.unavailable-title:هذا المشروع غير متاح`
          : $localize`:@@store.ui.loading:جارٍ التحميل…`,
        description: $localize`:@@store.project.unavailable-lede:ربما أُرشف هذا المشروع أو لم يُنشر بعد.`,
        path: `/p/${this.slug()}`,
        noindex: true,
      });
      return;
    }
    const locale = this.i18n.locale;
    this.seo.set({
      title: this.i18n.pick(p.seoTitleAr || p.titleAr, p.seoTitleEn || p.titleEn),
      description: this.i18n.pick(
        p.seoDescAr || p.summaryAr || p.titleAr,
        p.seoDescEn || p.summaryEn,
      ),
      path: `/p/${p.slug}`,
      image: p.coverUrl,
      ogType: 'article',
      jsonLd: projectJsonLd(
        p,
        locale,
        {
          home: this.seo.url(locale, '/'),
          category: `${this.seo.url(locale, '/')}?category=${p.category.slug}`,
          page: this.seo.url(locale, `/p/${p.slug}`),
        },
        {
          home: siteName(),
          association: $localize`:@@store.layout.association:جمعية التعلم الإلكتروني`,
        },
      ),
    });
  }
}
