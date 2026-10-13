import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { I18nService } from '../i18n/i18n';

export interface JsonLd {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

export interface SeoData {
  /** Page title without the site name (the service appends it). Omit on the home page. */
  title?: string;
  description: string;
  /** Path inside the locale, starting with `/` (`/p/smart-study`); canonical = https://store.ta3lom.sa/{locale}{path}. */
  path: string;
  /** Plan §2.2: cart, checkout, account, admin, search, login, thanks and 404 are `noindex`. */
  noindex?: boolean;
  /** Absolute image URL for Open Graph / Twitter. */
  image?: string | null;
  ogType?: 'website' | 'product' | 'book';
  jsonLd?: JsonLd | JsonLd[];
}

export const SITE_NAME_AR = 'متجر جمعية التعلم الإلكتروني';
export const SITE_NAME_EN = 'E-Learning Association Store';
const JSON_LD_ID = 'ta-seo-json-ld';

/** Every route calls `set()` (non-negotiable #4; a unit test checks every page does). Canonicals on store.ta3lom.sa. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);

  set(data: SeoData): void {
    const site = this.i18n.pick(SITE_NAME_AR, SITE_NAME_EN);
    const title = data.title ? `${data.title} — ${site}` : site;
    const canonical = this.url(this.i18n.locale, data.path);

    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ name: 'robots', content: data.noindex ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: data.ogType ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: site });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: data.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:locale', content: this.i18n.locale === 'ar' ? 'ar_SA' : 'en_US' });
    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: data.description });
    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: data.image });
      this.meta.updateTag({ name: 'twitter:image', content: data.image });
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    if (data.noindex) {
      this.removeLinks();
    } else {
      this.upsertLink('canonical', canonical);
      this.upsertLink('alternate', this.url('ar', data.path), 'ar');
      this.upsertLink('alternate', this.url('en', data.path), 'en');
      this.upsertLink('alternate', this.url('ar', data.path), 'x-default');
    }
    this.setJsonLd(data.noindex ? undefined : data.jsonLd);
  }

  /** Absolute URL of a store path in a locale. */
  url(locale: 'ar' | 'en', path: string): string {
    const p = path === '/' || path === '' ? '/' : path.startsWith('/') ? path : `/${path}`;
    return `${environment.siteOrigin}/${locale}${p}`;
  }

  private upsertLink(rel: string, href: string, hreflang?: string): void {
    const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
    let link = this.document.head.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', rel);
      if (hreflang) link.setAttribute('hreflang', hreflang);
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private removeLinks(): void {
    this.document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach((l) => l.remove());
  }

  private setJsonLd(jsonLd: JsonLd | JsonLd[] | undefined): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
    if (!jsonLd) return;
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }
}

/** Schema.org BreadcrumbList from [name, absolute url] pairs. */
export function breadcrumbJsonLd(items: readonly (readonly [string, string])[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}
