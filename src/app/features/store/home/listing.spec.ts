import {
  lastPage,
  listingParams,
  listingSeo,
  needsRewrite,
  pageCount,
  pageWindow,
  toParams,
  toQuery,
} from './listing';

describe('listing URL state (D-W3, C-4, U-2)', () => {
  it('reads the URL defensively', () => {
    expect(toQuery({})).toEqual({ q: '', category: '', sort: 'featured', page: 1 });
    expect(toQuery({ q: ' سقيا ', category: 'dawah', sort: 'newest', page: '٢' })).toEqual({
      q: 'سقيا',
      category: 'dawah',
      sort: 'newest',
      page: 2,
    });
    expect(toQuery({ sort: 'price', page: '-3', category: '../x' })).toEqual({
      q: '',
      category: '',
      sort: 'featured',
      page: 1,
    });
  });

  it('keeps the default request URL stable (the prerendered one) and never asks the API to re-sort', () => {
    expect(listingParams(toQuery({}))).toEqual({ page: 1, pageSize: 20 });
    expect(listingParams(toQuery({ sort: 'featured' }))).not.toHaveProperty('sort');
    expect(
      listingParams(toQuery({ sort: 'title', category: 'relief', q: 'x', page: '3' })),
    ).toEqual({
      page: 3,
      pageSize: 20,
      sort: 'title',
      category: 'relief',
      q: 'x',
    });
  });

  it('C-4: search → noindex; category → canonical on /; page > 1 → noindex, follow', () => {
    expect(listingSeo(toQuery({ q: 'water' }))).toEqual({
      path: '/',
      noindex: true,
      follow: false,
    });
    expect(listingSeo(toQuery({ category: 'dawah' }))).toEqual({
      path: '/',
      noindex: false,
      follow: false,
    });
    expect(listingSeo(toQuery({ page: '2' }))).toEqual({ path: '/', noindex: true, follow: true });
    expect(listingSeo(toQuery({}))).toEqual({ path: '/', noindex: false, follow: false });
  });

  it('M-5: normalises before any request — page, sort, q length, category slug', () => {
    expect(toQuery({ page: 'abc' }).page).toBe(1);
    expect(toQuery({ page: '0' }).page).toBe(1);
    expect(toQuery({ page: '2.5' }).page).toBe(1);
    expect(toQuery({ page: ' ٣ ' }).page).toBe(3);
    expect(toQuery({ sort: 'near-target' }).sort).toBe('featured');
    expect(toQuery({ q: 'x'.repeat(150) }).q).toHaveLength(100);
    expect(toQuery({ category: 'a' }).category).toBe('');
    expect(toQuery({ category: 'Water' }).category).toBe('');
    expect(toQuery({ category: 'c-water' }).category).toBe('c-water');
    expect(toQuery({ category: 'x'.repeat(61) }).category).toBe('');
  });

  it('M-5: a URL that differs from its clean form is rewritten; a clean one is not', () => {
    expect(needsRewrite({ sort: 'zakat' }, toQuery({ sort: 'zakat' }))).toBe(true);
    expect(needsRewrite({ page: '1' }, toQuery({ page: '1' }))).toBe(true);
    expect(needsRewrite({ q: '  ' }, toQuery({ q: '  ' }))).toBe(true);
    expect(
      needsRewrite({ category: 'c-water', page: '2' }, toQuery({ category: 'c-water', page: '2' })),
    ).toBe(false);
    expect(needsRewrite({}, toQuery({}))).toBe(false);
    expect(toParams(toQuery({ sort: 'newest', page: '2' }))).toEqual({
      q: null,
      category: null,
      sort: 'newest',
      page: 2,
    });
  });

  it('M-5: a page past the end → the last page; pages from the total', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
    expect(lastPage(9, 28)).toBe(2);
    expect(lastPage(2, 28)).toBe(2);
    expect(lastPage(5, 0)).toBe(1);
  });

  it('page window: all pages up to 7, else first, last, current ± 1 and gaps', () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });

  it('M-5: an unknown category is noindex', () => {
    expect(listingSeo(toQuery({ category: 'c-gone' }), true).noindex).toBe(true);
  });
});
