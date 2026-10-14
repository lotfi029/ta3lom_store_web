import type { PillTone } from '../../../shared/ui/status-pill/status-pill';

export function productStatus(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'published':
      return { label: $localize`:@@store.admin.status-published:منشور`, tone: 'success' };
    case 'archived':
      return { label: $localize`:@@store.admin.status-archived:مؤرشف`, tone: 'neutral' };
    default:
      return { label: $localize`:@@store.admin.status-draft:مسودة`, tone: 'warning' };
  }
}

export function productType(type: string): string {
  return type === 'book'
    ? $localize`:@@store.admin.type-book:كتاب`
    : $localize`:@@store.admin.type-course:دورة`;
}

/** The prerender notice (plan §2.4): live figures update at once, texts with the next site build. */
export const freshnessNotice = (): string =>
  $localize`:@@store.admin.freshness:تظهر الأسعار والمخزون في المتجر عند تحميل الصفحة التالية، أما العناوين ونصوص البحث فتتحدّث بعد إعادة بناء الموقع التالية.`;
