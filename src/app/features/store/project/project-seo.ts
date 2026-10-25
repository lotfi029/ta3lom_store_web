import type { ProjectDetail } from '../../../core/api/api.types';
import type { JsonLd } from '../../../core/seo/seo.service';
import { breadcrumbJsonLd } from '../../../core/seo/seo.service';
import { type Locale, pick } from '../../../core/i18n/i18n';
import { compare } from '../../../core/money/money';

/**
 * JSON-LD of a project page: a schema.org `DonateAction` (the project is what the visitor gives to; the NGO is the
 * recipient) and the `BreadcrumbList` home → category → project.
 */
export function projectJsonLd(
  p: ProjectDetail,
  locale: Locale,
  urls: { home: string; category: string; page: string },
  names: { home: string; association: string },
): JsonLd[] {
  const title = pick(locale, p.titleAr, p.titleEn);
  const action: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DonateAction',
    name: title,
    description: pick(locale, p.summaryAr ?? '', p.summaryEn) || undefined,
    url: urls.page,
    image: p.coverUrl ?? undefined,
    recipient: { '@type': 'NGO', name: names.association, url: 'https://ta3lom.sa' },
    priceSpecification: {
      '@type': 'PriceSpecification',
      priceCurrency: 'SAR',
      minPrice: p.options.length
        ? [...p.options.map((o) => o.amount)].sort(compare)[0]
        : p.minAmount,
    },
  };
  return [
    action,
    breadcrumbJsonLd([
      [names.home, urls.home],
      [pick(locale, p.category.nameAr, p.category.nameEn), urls.category],
      [title, urls.page],
    ]),
  ];
}
