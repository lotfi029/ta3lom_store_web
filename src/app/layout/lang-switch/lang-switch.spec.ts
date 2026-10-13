import { localeHref } from './lang-switch';

describe('localeHref (keeps the path)', () => {
  it('maps the same page to the other locale', () => {
    expect(localeHref('/p/smart-study', 'en')).toBe('/en/p/smart-study');
    expect(localeHref('/', 'en')).toBe('/en/');
    expect(localeHref('/courses?category=kids&page=2', 'ar')).toBe(
      '/ar/courses?category=kids&page=2',
    );
    expect(localeHref('/en/cart', 'ar')).toBe('/ar/cart');
  });
});
