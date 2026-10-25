import type { AdminCategory, AdminProject } from '../../../core/api/api.types';
import { categoryInput, categoryModel, sortError } from './categories.page';
import { fileSize } from './media.page';
import { uploadProblem } from './media-upload';
import {
  type OptionRow,
  hasDonationTarget,
  missingLabel,
  newOptionRow,
  optionProblems,
  optionRows,
  optionsInput,
  projectInput,
  projectModel,
} from './project-models';

const row = (o: Partial<OptionRow>): OptionRow => ({ ...newOptionRow(), ...o });

describe('options editor rules (API-3)', () => {
  it('rows follow the API sort order and keep ids', () => {
    const rows = optionRows([
      { id: 'b', labelAr: 'ب', labelEn: null, amount: '20.00', sort: 20, isActive: true },
      { id: 'a', labelAr: 'أ', labelEn: 'A', amount: '10.00', sort: '10', isActive: false },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ key: 'a', labelEn: 'A', isActive: false });
  });

  it('never lets a null/blank, too short/long or duplicate Arabic label through', () => {
    const p = optionProblems([
      row({ key: 'k1', labelAr: '', amount: '10' }),
      row({ key: 'k2', labelAr: 'س', amount: '10' }),
      row({ key: 'k3', labelAr: 'سهم كامل', amount: '10' }),
      row({ key: 'k4', labelAr: '  سهم   كامل ', amount: '10' }),
      row({ key: 'k5', labelAr: 'ل'.repeat(61), amount: '10' }),
      row({ key: 'k6', labelAr: 'نصف سهم', labelEn: 'x'.repeat(61), amount: '10' }),
    ]);
    expect(p).toEqual([
      { key: 'k1', field: 'labelAr', kind: 'required' },
      { key: 'k2', field: 'labelAr', kind: 'length' },
      { key: 'k4', field: 'labelAr', kind: 'duplicate' },
      { key: 'k5', field: 'labelAr', kind: 'length' },
      { key: 'k6', field: 'labelEn', kind: 'length' },
    ]);
  });

  it('amounts must be positive money in the API format (Arabic-Indic digits accepted)', () => {
    const bad = ['', '0', '-5', '1e3', '10.555', 'abc'];
    for (const amount of bad)
      expect(optionProblems([row({ key: 'k', labelAr: 'سهم', amount })])).toEqual([
        { key: 'k', field: 'amount', kind: 'amount' },
      ]);
    expect(optionProblems([row({ labelAr: 'سهم', amount: '٥٠٫٥' })])).toEqual([]);
  });

  it('caps the list at 50 options', () => {
    const rows = Array.from({ length: 51 }, (_, i) => row({ labelAr: `خيار ${i}`, amount: '5' }));
    expect(optionProblems(rows)).toEqual([{ key: null, field: null, kind: 'too-many' }]);
  });

  it('sends a full replacement: trimmed labels, null English, normalised money, sort by position, version', () => {
    const body = optionsInput(
      [
        row({ id: 'x', labelAr: ' نصف  سهم ', labelEn: ' ', amount: '٢٥', isActive: false }),
        row({ labelAr: 'سهم', labelEn: 'Share', amount: '50.5' }),
      ],
      7,
    );
    expect(body).toEqual({
      version: 7,
      options: [
        { id: 'x', labelAr: 'نصف سهم', labelEn: null, amount: '25.00', sort: 0, isActive: false },
        { id: null, labelAr: 'سهم', labelEn: 'Share', amount: '50.50', sort: 10, isActive: true },
      ],
    });
  });

  it('knows when a project would have nothing to donate to (publish missing "amount")', () => {
    expect(hasDonationTarget(false, [row({ isActive: false })])).toBe(false);
    expect(hasDonationTarget(true, [])).toBe(true);
    expect(hasDonationTarget(false, [row({ isActive: true })])).toBe(true);
    expect(missingLabel('cover')).not.toBe('cover');
    expect(missingLabel('unknown_key')).toBe('unknown_key');
  });
});

describe('project and category forms', () => {
  const project = {
    id: 'p1',
    categoryId: 'c1',
    slug: 'well',
    status: 'draft',
    titleAr: 'بئر',
    titleEn: null,
    summaryAr: 'ملخص',
    summaryEn: null,
    bodyAr: null,
    bodyEn: null,
    coverAssetId: null,
    coverUrl: null,
    allowOpenAmount: true,
    minAmount: '25.00',
    badge: 'urgent',
    sort: 3,
    seoTitleAr: null,
    seoTitleEn: null,
    seoDescAr: null,
    seoDescEn: null,
    options: [],
    oldSlugs: [],
    missingForPublish: ['bodyAr', 'cover'],
    publishedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    version: 4,
  } as AdminProject;

  it('round-trips a project: blanks → null, money normalised, version sent', () => {
    const m = { ...projectModel(project), titleEn: '  ', minAmount: '٣٠', slug: ' well ' };
    expect(projectInput(m, 4)).toMatchObject({
      categoryId: 'c1',
      slug: 'well',
      titleAr: 'بئر',
      titleEn: null,
      minAmount: '30.00',
      badge: 'urgent',
      sort: 3,
      allowOpenAmount: true,
      version: 4,
    });
    expect(projectInput({ ...m, minAmount: '', badge: '' }, null)).toMatchObject({
      minAmount: null,
      badge: null,
      version: null,
    });
  });

  it('category: trimmed input, optional texts null, version only on update', () => {
    const c = {
      id: 'c1',
      slug: 'water',
      nameAr: 'سقيا',
      nameEn: 'Water',
      descriptionAr: null,
      descriptionEn: null,
      imageAssetId: null,
      imageUrl: null,
      acceptsGeneralGifts: true,
      sort: 10,
      isActive: true,
      projectCount: 2,
      updatedAt: '2026-10-01T00:00:00Z',
      version: 9,
    } as AdminCategory;
    expect(categoryInput({ ...categoryModel(c, 0), nameEn: ' ' }, 9)).toEqual({
      slug: 'water',
      nameAr: 'سقيا',
      nameEn: null,
      descriptionAr: null,
      descriptionEn: null,
      imageAssetId: null,
      acceptsGeneralGifts: true,
      isActive: true,
      sort: 10,
      version: 9,
    });
    expect(categoryModel(null, 30).sort).toBe('30');
    expect(sortError('١٠')).toBeUndefined();
    expect(sortError('10001')).toBeDefined();
    expect(sortError('-1')).toBeDefined();
  });
});

describe('media', () => {
  it('checks type and Arabic alt text; the size limit is the API’s (413 max)', () => {
    expect(uploadProblem(null, 'x')).toBeTruthy();
    expect(uploadProblem({ type: 'image/svg+xml' }, 'x')).toBeTruthy();
    expect(uploadProblem({ type: 'image/png' }, '  ')).toBeTruthy();
    expect(uploadProblem({ type: 'image/webp' }, 'صورة')).toBeNull();
  });

  it('shows sizes in KB or MB', () => {
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize('5242880')).toBe('5.0 MB');
  });
});
