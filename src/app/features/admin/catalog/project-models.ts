import type {
  AdminProject,
  AdminProjectOption,
  ProjectBadge,
  ProjectInput,
  ProjectOptionsInput,
} from '../../../core/api/api.types';
import { toInt } from '../../../core/api/api.types';
import { checkAmount } from '../../../core/money/amount';
import { westernDigits } from '../../../core/i18n/western-digits';

/** Project slugs as the API validates them (contract 15 §2.7). */
export const PROJECT_SLUG = /^[a-z0-9-]{2,80}$/;
/** `PUT …/options`: at most 50 options, `labelAr` 2–60 (trimmed, unique), `labelEn` ≤ 60 (contract 15 §2.7). */
export const MAX_OPTIONS = 50;
const LABEL_MIN = 2;
const LABEL_MAX = 60;

export interface ProjectModel {
  categoryId: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  bodyAr: string;
  bodyEn: string;
  coverAssetId: string | null;
  coverUrl: string | null;
  coverAlt: string;
  allowOpenAmount: boolean;
  /** As typed (Arabic-Indic digits allowed); blank = the store-wide minimum from the settings. */
  minAmount: string;
  badge: '' | ProjectBadge;
  sort: string;
  seoTitleAr: string;
  seoTitleEn: string;
  seoDescAr: string;
  seoDescEn: string;
}

export function projectModel(p: AdminProject | null): ProjectModel {
  return {
    categoryId: p?.categoryId ?? '',
    slug: p?.slug ?? '',
    titleAr: p?.titleAr ?? '',
    titleEn: p?.titleEn ?? '',
    summaryAr: p?.summaryAr ?? '',
    summaryEn: p?.summaryEn ?? '',
    bodyAr: p?.bodyAr ?? '',
    bodyEn: p?.bodyEn ?? '',
    coverAssetId: p?.coverAssetId ?? null,
    coverUrl: p?.coverUrl ?? null,
    coverAlt: '',
    allowOpenAmount: p?.allowOpenAmount ?? false,
    minAmount: p?.minAmount ?? '',
    badge: p?.badge === 'new' || p?.badge === 'urgent' ? p.badge : '',
    sort: String(p ? toInt(p.sort) : 0),
    seoTitleAr: p?.seoTitleAr ?? '',
    seoTitleEn: p?.seoTitleEn ?? '',
    seoDescAr: p?.seoDescAr ?? '',
    seoDescEn: p?.seoDescEn ?? '',
  };
}

/** The form → `ProjectInput` (trimmed; blank optional texts → null; money normalised to `"50.00"`). */
export function projectInput(m: ProjectModel, version: number | null): ProjectInput {
  const opt = (s: string) => s.trim() || null;
  const min = checkAmount(m.minAmount, null, null);
  return {
    categoryId: m.categoryId,
    slug: m.slug.trim(),
    titleAr: m.titleAr.trim(),
    titleEn: opt(m.titleEn),
    summaryAr: opt(m.summaryAr),
    summaryEn: opt(m.summaryEn),
    bodyAr: opt(m.bodyAr),
    bodyEn: opt(m.bodyEn),
    coverAssetId: m.coverAssetId,
    allowOpenAmount: m.allowOpenAmount,
    minAmount: min.ok ? min.amount : null,
    badge: m.badge || null,
    sort: Number.parseInt(westernDigits(m.sort).trim(), 10) || 0,
    seoTitleAr: opt(m.seoTitleAr),
    seoTitleEn: opt(m.seoTitleEn),
    seoDescAr: opt(m.seoDescAr),
    seoDescEn: opt(m.seoDescEn),
    version,
  };
}

/** One row of the options editor. `key` is local (stable across reorders); `id` null = a new option. */
export interface OptionRow {
  key: string;
  id: string | null;
  labelAr: string;
  labelEn: string;
  amount: string;
  isActive: boolean;
}

let seq = 0;
export const newOptionRow = (): OptionRow => ({
  key: `new-${++seq}`,
  id: null,
  labelAr: '',
  labelEn: '',
  amount: '',
  isActive: true,
});

/** The project's options in the API's order (`sort`), as editor rows. */
export function optionRows(options: readonly AdminProjectOption[]): OptionRow[] {
  return [...options]
    .sort((a, b) => toInt(a.sort) - toInt(b.sort))
    .map((o) => ({
      key: o.id,
      id: o.id,
      labelAr: o.labelAr ?? '',
      labelEn: o.labelEn ?? '',
      amount: o.amount ?? '',
      isActive: o.isActive,
    }));
}

export type OptionField = 'labelAr' | 'labelEn' | 'amount';
export interface OptionProblem {
  /** Row key, or null for the list as a whole. */
  key: string | null;
  field: OptionField | null;
  kind: 'required' | 'length' | 'duplicate' | 'amount' | 'too-many';
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Client checks before `PUT …/options`, so mistakes show on the row before a round trip (the API validates the same
 * rules and answers 400 `validation.failed`): every row has an Arabic label of 2–60 characters, unique after trimming; the English label ≤ 60; a positive
 * amount in the API's money format; at most 50 rows.
 */
export function optionProblems(rows: readonly OptionRow[]): OptionProblem[] {
  const out: OptionProblem[] = [];
  if (rows.length > MAX_OPTIONS) out.push({ key: null, field: null, kind: 'too-many' });
  const seen = new Map<string, string>();
  for (const r of rows) {
    const ar = norm(r.labelAr);
    if (!ar) out.push({ key: r.key, field: 'labelAr', kind: 'required' });
    else if ([...ar].length < LABEL_MIN || [...ar].length > LABEL_MAX)
      out.push({ key: r.key, field: 'labelAr', kind: 'length' });
    else if (seen.has(ar)) out.push({ key: r.key, field: 'labelAr', kind: 'duplicate' });
    else seen.set(ar, r.key);
    if ([...norm(r.labelEn)].length > LABEL_MAX)
      out.push({ key: r.key, field: 'labelEn', kind: 'length' });
    if (!checkAmount(r.amount, null, null).ok)
      out.push({ key: r.key, field: 'amount', kind: 'amount' });
  }
  return out;
}

/** Rows → the full replacement body; `sort` = position × 10. Only call when `optionProblems` is empty. */
export function optionsInput(rows: readonly OptionRow[], version: number): ProjectOptionsInput {
  return {
    options: rows.map((r, i) => {
      const amount = checkAmount(r.amount, null, null);
      return {
        id: r.id,
        labelAr: norm(r.labelAr),
        labelEn: norm(r.labelEn) || null,
        amount: amount.ok ? amount.amount : '0.00',
        sort: i * 10,
        isActive: r.isActive,
      };
    }),
    version,
  };
}

/** Would the project (as edited) have something to donate to? (publish `missing: ["amount"]`). */
export const hasDonationTarget = (allowOpenAmount: boolean, rows: readonly OptionRow[]): boolean =>
  allowOpenAmount || rows.some((r) => r.isActive);

/** `missingForPublish` / 422 `missing[]` keys (contract 15 §1.9) → what to fill in. */
export function missingLabel(key: string): string {
  switch (key) {
    case 'titleAr':
      return $localize`:@@store.admin.missing-title:العنوان بالعربية`;
    case 'summaryAr':
      return $localize`:@@store.admin.missing-summary:الملخص بالعربية`;
    case 'bodyAr':
      return $localize`:@@store.admin.missing-body:القصة بالعربية`;
    case 'cover':
      return $localize`:@@store.admin.missing-cover:صورة الغلاف`;
    case 'category':
      return $localize`:@@store.admin.missing-category:تصنيف نشط`;
    case 'amount':
      return $localize`:@@store.admin.missing-amount:خيار تبرع نشط أو السماح بمبلغ مفتوح`;
    default:
      return key;
  }
}

/** The text for an option problem. */
export function optionProblemText(p: OptionProblem): string {
  switch (p.kind) {
    case 'too-many':
      return $localize`:@@store.admin.options-too-many:${MAX_OPTIONS}:max: خيارًا على الأكثر.`;
    case 'required':
      return $localize`:@@store.admin.option-label-required:أدخل اسم الخيار بالعربية.`;
    case 'length':
      return $localize`:@@store.admin.option-label-length:من 2 إلى 60 حرفًا.`;
    case 'duplicate':
      return $localize`:@@store.admin.option-label-duplicate:اسم مكرر لخيار آخر.`;
    case 'amount':
      return $localize`:@@store.admin.option-amount-invalid:أدخل مبلغًا موجبًا (مثل 50 أو 50.25).`;
  }
}
