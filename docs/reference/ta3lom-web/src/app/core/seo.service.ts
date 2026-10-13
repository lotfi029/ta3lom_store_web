import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService } from './i18n';

export interface SeoJsonLd {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

export interface SeoData {
  title: string;
  description: string;
  /** Absolute URL of the current page, current locale. */
  canonical: string;
  /** Absolute URL of a representative image, for Open Graph / Twitter. */
  image?: string;
  jsonLd?: SeoJsonLd | SeoJsonLd[];
}

const JSON_LD_ID = 'ta-seo-json-ld';

/**
 * The association's name as it appears in the browser tab: Arabic in both locales, because a
 * name is not translated in a title bar. Every route composes '<page> — SITE_TITLE'; the home
 * page uses it alone.
 */
export const SITE_TITLE = 'جمعية التعلم الإلكتروني';

const SITE_NAME_AR = SITE_TITLE;
const SITE_NAME_EN = 'E-Learning Association';

/**
 * Called from every route's component on init. Closes audit findings F-14 (missing meta
 * description) and F-15 (missing Open Graph) — see docs/architecture/02-frontend-architecture.md
 * "SEO".
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);

  set(data: SeoData): void {
    this.title.setTitle(data.title);
    this.meta.updateTag({ name: 'description', content: data.description });

    const siteName = this.i18n.pick(SITE_NAME_AR, SITE_NAME_EN);
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: data.canonical });
    this.meta.updateTag({ property: 'og:locale', content: this.i18n.locale === 'ar' ? 'ar_SA' : 'en_US' });

    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: data.title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });

    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: data.image });
      this.meta.updateTag({ name: 'twitter:image', content: data.image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    this.setCanonicalAndAlternates(data.canonical);
    this.setJsonLd(data.jsonLd);
  }

  /**
   * For /admin/** routes only. No Open Graph, no canonical, no hreflang alternates — those are
   * for public, crawlable pages, and the admin is neither: it is excluded from prerendering
   * entirely (ADR-002) and must never be indexed. `robots: noindex` is the one thing every
   * admin screen still needs, which is why this stays on SeoService rather than becoming its
   * own service — same Title/Meta injection, a narrower job.
   */
  setAdminTitle(title: string): void {
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  private setCanonicalAndAlternates(canonical: string): void {
    const arUrl = this.swapLocaleInUrl(canonical, 'ar');
    const enUrl = this.swapLocaleInUrl(canonical, 'en');

    this.upsertLink('canonical', canonical);
    this.upsertLink('alternate', arUrl, 'ar');
    this.upsertLink('alternate', enUrl, 'en');
    this.upsertLink('alternate', arUrl, 'x-default');
  }

  private swapLocaleInUrl(url: string, target: 'ar' | 'en'): string {
    return url.replace(/\/(ar|en)(\/|$)/, `/${target}$2`);
  }

  private upsertLink(rel: string, href: string, hreflang?: string): void {
    const selector = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]`;
    let link = this.document.head.querySelector(selector) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', rel);
      if (hreflang) link.setAttribute('hreflang', hreflang);
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setJsonLd(jsonLd: SeoJsonLd | SeoJsonLd[] | undefined): void {
    const existing = this.document.getElementById(JSON_LD_ID);
    if (existing) existing.remove();
    if (!jsonLd) return;

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify(jsonLd);
    this.document.head.appendChild(script);
  }
}
