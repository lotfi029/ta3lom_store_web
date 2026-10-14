import type {
  AdminFormat,
  AdminModule,
  AdminProduct,
  BookDetailInput,
  BookFormatInput,
  CourseDetailInput,
  CourseModuleInput,
  ProductCard,
  ProductDetail,
  ProductInput,
} from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { westernDigits } from '../../../core/i18n/western-digits';
import { compare, normalize } from '../../../core/money/money';

/** Slugs as the API validates them (lower-case letters, digits, dashes). */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blank = (v: string): string | null => (v.trim() ? v.trim() : null);
const int = (v: string): number => Number.parseInt(westernDigits(v).trim(), 10);
const intOrNull = (v: string): number | null => (westernDigits(v).trim() ? int(v) : null);

/** A decimal money string or null; throws on anything else (the forms validate first). */
export function money(v: string): string {
  return normalize(westernDigits(v).trim());
}

export function isMoney(v: string): boolean {
  try {
    money(v);
    return !westernDigits(v).trim().startsWith('-');
  } catch {
    return false;
  }
}

export const isInt = (v: string, min = 0): boolean =>
  /^\d+$/.test(westernDigits(v).trim()) && int(v) >= min;

/** RUL-04/05: a compare-at price must be above the price. */
export function compareAtValid(price: string, compareAt: string): boolean {
  if (!compareAt.trim()) return true;
  if (!isMoney(price) || !isMoney(compareAt)) return false;
  return compare(money(compareAt), money(price)) > 0;
}

export interface GeneralModel {
  type: 'course' | 'book';
  slug: string;
  categoryId: string;
  coverAssetId: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  bodyAr: string;
  bodyEn: string;
  badge: '' | 'best' | 'new';
  sort: string;
  seoTitleAr: string;
  seoTitleEn: string;
  seoDescAr: string;
  seoDescEn: string;
}

export const emptyGeneral = (type: 'course' | 'book'): GeneralModel => ({
  type,
  slug: '',
  categoryId: '',
  coverAssetId: '',
  titleAr: '',
  titleEn: '',
  summaryAr: '',
  summaryEn: '',
  bodyAr: '',
  bodyEn: '',
  badge: '',
  sort: '0',
  seoTitleAr: '',
  seoTitleEn: '',
  seoDescAr: '',
  seoDescEn: '',
});

export function toGeneral(p: AdminProduct): GeneralModel {
  return {
    type: p.type === 'book' ? 'book' : 'course',
    slug: p.slug,
    categoryId: p.categoryId ?? '',
    coverAssetId: p.coverAssetId ?? '',
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? '',
    summaryAr: p.summaryAr,
    summaryEn: p.summaryEn ?? '',
    bodyAr: p.bodyAr ?? '',
    bodyEn: p.bodyEn ?? '',
    badge: p.badge === 'best' || p.badge === 'new' ? p.badge : '',
    sort: String(toInt(p.sort)),
    seoTitleAr: p.seoTitleAr ?? '',
    seoTitleEn: p.seoTitleEn ?? '',
    seoDescAr: p.seoDescAr ?? '',
    seoDescEn: p.seoDescEn ?? '',
  };
}

export function fromGeneral(g: GeneralModel): ProductInput {
  return {
    type: g.type,
    slug: g.slug.trim(),
    categoryId: g.categoryId || null,
    coverAssetId: g.coverAssetId || null,
    titleAr: g.titleAr.trim(),
    titleEn: blank(g.titleEn),
    summaryAr: g.summaryAr.trim(),
    summaryEn: blank(g.summaryEn),
    bodyAr: blank(g.bodyAr),
    bodyEn: blank(g.bodyEn),
    badge: g.badge || null,
    sort: isInt(g.sort) ? int(g.sort) : 0,
    seoTitleAr: blank(g.seoTitleAr),
    seoTitleEn: blank(g.seoTitleEn),
    seoDescAr: blank(g.seoDescAr),
    seoDescEn: blank(g.seoDescEn),
  };
}

export interface CourseModel {
  price: string;
  compareAtPrice: string;
  lessons: string;
  durationMinutes: string;
  levelAr: string;
  levelEn: string;
  instructorAr: string;
  instructorEn: string;
  accessDays: string;
  lmsCourseRef: string;
  learnerCount: string;
}

export function toCourse(p: AdminProduct): CourseModel {
  const c = p.course;
  return {
    price: c?.price ?? '',
    compareAtPrice: c?.compareAtPrice ?? '',
    lessons: c ? String(toInt(c.lessons)) : '0',
    durationMinutes: c ? String(toInt(c.durationMinutes)) : '0',
    levelAr: c?.levelAr ?? '',
    levelEn: c?.levelEn ?? '',
    instructorAr: c?.instructorAr ?? '',
    instructorEn: c?.instructorEn ?? '',
    accessDays:
      c?.accessDays === null || c?.accessDays === undefined ? '' : String(toInt(c.accessDays)),
    lmsCourseRef: c?.lmsCourseRef ?? '',
    learnerCount: c ? String(toInt(c.learnerCount)) : '0',
  };
}

export function fromCourse(m: CourseModel): CourseDetailInput {
  return {
    price: money(m.price),
    compareAtPrice: m.compareAtPrice.trim() ? money(m.compareAtPrice) : null,
    lessons: int(m.lessons),
    durationMinutes: int(m.durationMinutes),
    levelAr: blank(m.levelAr),
    levelEn: blank(m.levelEn),
    instructorAr: m.instructorAr.trim(),
    instructorEn: blank(m.instructorEn),
    accessDays: intOrNull(m.accessDays),
    lmsCourseRef: blank(m.lmsCourseRef),
    learnerCount: int(m.learnerCount),
  };
}

export interface ModuleRow {
  id: string;
  titleAr: string;
  titleEn: string;
  minutes: string;
}

let seq = 0;
export const newModuleRow = (): ModuleRow => ({
  id: `m-new-${++seq}`,
  titleAr: '',
  titleEn: '',
  minutes: '0',
});

export const toModules = (mods: readonly AdminModule[]): ModuleRow[] =>
  [...mods]
    .sort((a, b) => toInt(a.sort) - toInt(b.sort))
    .map((m) => ({
      id: m.id,
      titleAr: m.titleAr,
      titleEn: m.titleEn ?? '',
      minutes: String(Math.round(toInt(m.durationSeconds) / 60)),
    }));

/** The curriculum in order (sort = position), durations in seconds. */
export const fromModules = (rows: readonly ModuleRow[]): CourseModuleInput[] =>
  rows.map((r, i) => ({
    sort: i + 1,
    titleAr: r.titleAr.trim(),
    titleEn: blank(r.titleEn),
    durationSeconds: (isInt(r.minutes) ? int(r.minutes) : 0) * 60,
  }));

export interface BookModel {
  authorAr: string;
  authorEn: string;
  pages: string;
  isbn: string;
  publishedYear: string;
}

export const toBook = (p: AdminProduct): BookModel => ({
  authorAr: p.book?.authorAr ?? '',
  authorEn: p.book?.authorEn ?? '',
  pages: p.book?.pages === null || p.book?.pages === undefined ? '' : String(toInt(p.book.pages)),
  isbn: p.book?.isbn ?? '',
  publishedYear:
    p.book?.publishedYear === null || p.book?.publishedYear === undefined
      ? ''
      : String(toInt(p.book.publishedYear)),
});

export const fromBook = (m: BookModel): BookDetailInput => ({
  authorAr: m.authorAr.trim(),
  authorEn: blank(m.authorEn),
  pages: intOrNull(m.pages),
  isbn: blank(m.isbn),
  publishedYear: intOrNull(m.publishedYear),
});

export interface FormatModel {
  id: string | null;
  kind: 'print' | 'digital';
  sku: string;
  price: string;
  compareAtPrice: string;
  isActive: boolean;
  weightGrams: string;
  lowStockThreshold: string;
  fileAssetId: string;
}

export const toFormat = (f: AdminFormat): FormatModel => ({
  id: f.id,
  kind: f.kind === 'print' ? 'print' : 'digital',
  sku: f.sku,
  price: f.price,
  compareAtPrice: f.compareAtPrice ?? '',
  isActive: f.isActive,
  weightGrams:
    f.weightGrams === null || f.weightGrams === undefined ? '' : String(toInt(f.weightGrams)),
  lowStockThreshold:
    f.lowStockThreshold === null || f.lowStockThreshold === undefined
      ? ''
      : String(toInt(f.lowStockThreshold)),
  fileAssetId: f.fileAssetId ?? '',
});

export const newFormat = (kind: 'print' | 'digital', slug: string): FormatModel => ({
  id: null,
  kind,
  sku: `BK-${slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .slice(0, 24)}-${kind === 'print' ? 'P' : 'D'}`,
  price: '',
  compareAtPrice: '',
  isActive: true,
  weightGrams: '',
  lowStockThreshold: '',
  fileAssetId: '',
});

/** Problems with a format before saving (empty = fine). */
export function formatErrors(f: FormatModel): string[] {
  const e: string[] = [];
  if (!f.sku.trim()) e.push($localize`:@@store.admin.sku-required:أدخل رمز المنتج (SKU).`);
  if (!isMoney(f.price)) e.push($localize`:@@store.admin.money-invalid:أدخل مبلغًا مثل 25.00`);
  if (!compareAtValid(f.price, f.compareAtPrice))
    e.push($localize`:@@store.admin.compare-at-invalid:السعر قبل الخصم يجب أن يكون أعلى من السعر.`);
  if (f.weightGrams.trim() && !isInt(f.weightGrams))
    e.push($localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.`);
  if (f.lowStockThreshold.trim() && !isInt(f.lowStockThreshold))
    e.push($localize`:@@store.admin.integer-invalid:أدخل عددًا صحيحًا.`);
  return e;
}

export const fromFormat = (f: FormatModel): BookFormatInput => ({
  kind: f.kind,
  sku: f.sku.trim(),
  price: money(f.price),
  compareAtPrice: f.compareAtPrice.trim() ? money(f.compareAtPrice) : null,
  isActive: f.isActive,
  weightGrams: f.kind === 'print' ? intOrNull(f.weightGrams) : null,
  lowStockThreshold: f.kind === 'print' ? intOrNull(f.lowStockThreshold) : null,
  fileAssetId: f.kind === 'digital' ? f.fileAssetId || null : null,
});

/** The public preview (#66) as a store card, so staff see the product as the catalogue shows it. */
export function previewCard(d: ProductDetail): ProductCard {
  const formats = d.book?.formats ?? [];
  const lowest = formats.reduce<string | null>(
    (min, f) => (min === null || compare(f.price, min) < 0 ? f.price : min),
    null,
  );
  return {
    id: d.id,
    type: d.type,
    slug: d.slug,
    titleAr: d.titleAr,
    titleEn: d.titleEn,
    summaryAr: d.summaryAr,
    summaryEn: d.summaryEn,
    badge: d.badge,
    category: d.category,
    cover: d.cover,
    price: d.course?.price ?? lowest,
    compareAtPrice: d.course?.compareAtPrice ?? null,
    formats: d.book ? formats.map((f) => ({ kind: f.kind, price: f.price })) : null,
    sponsorship: null,
    goal: null,
  };
}
