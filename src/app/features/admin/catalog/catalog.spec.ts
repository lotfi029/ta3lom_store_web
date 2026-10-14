import { CATEGORY_SLUG } from './categories.page';
import { uploadProblem } from './media-upload';
import {
  SLUG,
  compareAtValid,
  formatErrors,
  fromCourse,
  fromFormat,
  fromModules,
  newFormat,
  previewCard,
  toCourse,
} from './product-models';
import type { AdminProduct, ProductDetail } from '../../../core/api/api.types';

describe('admin catalogue models (W-09)', () => {
  it('slugs: lower-case words joined by dashes', () => {
    expect(SLUG.test('python-kids')).toBe(true);
    expect(SLUG.test('Python Kids')).toBe(false);
    expect(SLUG.test('-x')).toBe(false);
    expect(CATEGORY_SLUG.test('tech')).toBe(true);
    expect(CATEGORY_SLUG.test('t')).toBe(false);
  });

  it('a compare-at price must be above the price (RUL-04/05)', () => {
    expect(compareAtValid('350', '')).toBe(true);
    expect(compareAtValid('350.00', '450')).toBe(true);
    expect(compareAtValid('350.00', '350')).toBe(false);
    expect(compareAtValid('350.00', '300')).toBe(false);
  });

  it('course details: money as decimal strings, counts as integers, blank access = lifetime', () => {
    const m = {
      ...toCourse({ course: null } as AdminProduct),
      price: '٣٥٠',
      compareAtPrice: '',
      lessons: '12',
      durationMinutes: '90',
      instructorAr: ' هند ',
      accessDays: '',
      learnerCount: '0',
    };
    expect(fromCourse(m)).toMatchObject({
      price: '350.00',
      compareAtPrice: null,
      lessons: 12,
      durationMinutes: 90,
      instructorAr: 'هند',
      accessDays: null,
    });
  });

  it('curriculum: sort is the position, durations in seconds', () => {
    expect(
      fromModules([
        { id: 'a', titleAr: 'أ', titleEn: '', minutes: '5' },
        { id: 'b', titleAr: 'ب', titleEn: 'B', minutes: '0' },
      ]),
    ).toEqual([
      { sort: 1, titleAr: 'أ', titleEn: null, durationSeconds: 300 },
      { sort: 2, titleAr: 'ب', titleEn: 'B', durationSeconds: 0 },
    ]);
  });

  it('formats: validated before saving; print keeps weight/threshold, digital keeps the file', () => {
    const p = { ...newFormat('print', 'my-book'), price: '65', compareAtPrice: '60' };
    expect(p.sku).toBe('BK-MY-BOOK-P');
    expect(formatErrors(p).length).toBe(1);
    expect(
      fromFormat({ ...p, compareAtPrice: '', weightGrams: '450', fileAssetId: 'x' }),
    ).toMatchObject({ price: '65.00', weightGrams: 450, fileAssetId: null });
    expect(
      fromFormat({
        ...newFormat('digital', 'b'),
        price: '35',
        weightGrams: '9',
        fileAssetId: 'f1',
      }),
    ).toMatchObject({ weightGrams: null, fileAssetId: 'f1' });
  });

  it('uploads: MIME per kind, size limits, alt text required for images (RUL-03)', () => {
    const png = { type: 'image/png', size: 1000 };
    expect(uploadProblem('image', png, 'بديل', 'alt')).toBeNull();
    expect(uploadProblem('image', png, '', 'alt')).not.toBeNull();
    expect(uploadProblem('image', { type: 'application/pdf', size: 1 }, 'a', 'b')).not.toBeNull();
    expect(
      uploadProblem('image', { type: 'image/png', size: 11 * 1024 * 1024 }, 'a', 'b'),
    ).not.toBeNull();
    expect(uploadProblem('book_file', { type: 'application/pdf', size: 5 }, '', '')).toBeNull();
    expect(uploadProblem('book_file', null, '', '')).not.toBeNull();
  });

  it('the preview becomes a store card: a book shows its lowest format price', () => {
    const d = {
      id: 'p',
      type: 'book',
      slug: 's',
      titleAr: 'ك',
      titleEn: null,
      summaryAr: 'م',
      summaryEn: null,
      badge: null,
      category: null,
      cover: null,
      course: null,
      book: {
        formats: [
          { kind: 'print', price: '65.00' },
          { kind: 'digital', price: '35.00' },
        ],
      },
    } as unknown as ProductDetail;
    const card = previewCard(d);
    expect(card.price).toBe('35.00');
    expect(card.formats).toEqual([
      { kind: 'print', price: '65.00' },
      { kind: 'digital', price: '35.00' },
    ]);
    expect(card.sponsorship).toBeNull();
  });
});
