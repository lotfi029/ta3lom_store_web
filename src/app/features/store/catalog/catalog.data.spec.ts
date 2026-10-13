import { pageOf, sortOf, storeItems } from './catalog.data';

describe('catalogue query parsing', () => {
  it('accepts only the documented sorts', () => {
    expect(sortOf('price_asc')).toBe('price_asc');
    expect(sortOf('drop table')).toBe('featured');
    expect(sortOf(undefined)).toBe('featured');
  });

  it('pages are positive integers', () => {
    expect(pageOf('3')).toBe(3);
    expect(pageOf('0')).toBe(1);
    expect(pageOf('-2')).toBe(1);
    expect(pageOf('2.5')).toBe(1);
    expect(pageOf('x')).toBe(1);
  });

  it('keeps courses and books only (r4)', () => {
    const page = {
      items: [{ type: 'course' }, { type: 'cause' }, { type: 'book' }],
      total: 3,
      page: 1,
      pageSize: 12,
    };
    expect(storeItems(page as never).map((p) => p.type)).toEqual(['course', 'book']);
  });
});
