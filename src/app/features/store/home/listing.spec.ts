import { listingParams, listingSeo, toQuery } from './listing';

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
    expect(listingParams(toQuery({}))).toEqual({ page: 1, pageSize: 12 });
    expect(listingParams(toQuery({ sort: 'featured' }))).not.toHaveProperty('sort');
    expect(
      listingParams(toQuery({ sort: 'title', category: 'relief', q: 'x', page: '3' })),
    ).toEqual({
      page: 3,
      pageSize: 12,
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
});
