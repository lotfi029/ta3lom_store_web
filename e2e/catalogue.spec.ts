import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { type CardLite, apiGet } from './support/api';

/** W-03 — home, catalogues, search, product pages against the real API. Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`catalogue /${locale}`, () => {
    test('home: hero, featured, courses and books from the API', async ({ page }) => {
      const home = await apiGet<{ courses: CardLite[]; books: CardLite[] }>('/catalog/home');
      await page.goto(`/${locale}/`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.hero h1')).toBeVisible();
      const courseCards = page.locator('section[aria-labelledby="courses-h"] .pcard');
      await expect(courseCards).toHaveCount(
        Math.min(6, home.courses.filter((p) => p.type === 'course').length),
      );
      await expect(page.locator('section[aria-labelledby="books-h"] .pcard')).toHaveCount(
        Math.min(4, home.books.length),
      );
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('courses: category chips from the API, filter, sort and canonical', async ({ page }) => {
      const cats =
        await apiGet<{ slug: string; nameAr: string; nameEn: string | null }[]>(
          '/catalog/categories',
        );
      const courses = await apiGet<{ items: CardLite[] }>(
        '/catalog/products?type=course&pageSize=100',
      );
      await page.goto(`/${locale}/courses`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        `https://store.ta3lom.sa/${locale}/courses`,
      );
      // one chip per API category + "all"
      await expect(page.locator('.filters a')).toHaveCount(cats.length + 1);
      await expect(page.locator('.pcard')).toHaveCount(Math.min(12, courses.items.length));

      const withCat = courses.items.find((c) => c.category)!;
      const cat = withCat.category!.slug;
      const expected = courses.items.filter((c) => c.category?.slug === cat).length;
      await page.locator(`.filters a[href*="category=${cat}"]`).click();
      await expect(page).toHaveURL(new RegExp(`category=${cat}`));
      await expect(page.locator('.pcard')).toHaveCount(expected);
      await expect(page.locator(`.filters a[href*="category=${cat}"]`)).toHaveAttribute(
        'aria-current',
        'true',
      );

      await page.locator('#sort').selectOption('price_asc');
      await expect(page).toHaveURL(/sort=price_asc/);
      await expectNoA11yViolations(page, `/${locale}/courses filtered`);
    });

    test('books: format tags and "from" price', async ({ page }) => {
      await page.goto(`/${locale}/books`);
      const first = page.locator('.pcard').first();
      await expect(first.locator('.tag.fmt').first()).toBeVisible();
      await expect(first.locator('ta-money')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/books`);
    });

    test('search finds products and reports none for nonsense', async ({ page }) => {
      const courses = await apiGet<{ items: CardLite[] }>(
        '/catalog/products?type=course&pageSize=1',
      );
      const word = courses.items[0].titleAr.split(' ')[0];
      await page.goto(`/${locale}/search?q=${encodeURIComponent(word)}`);
      await expect(page.locator('.pcard').first()).toBeVisible();
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await page.goto(`/${locale}/search?q=zzzqqqxx`);
      await expect(page.locator('.empty')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/search empty`);
    });

    test('course page: curriculum, instructor, live price, JSON-LD, share', async ({ page }) => {
      const list = await apiGet<{ items: CardLite[] }>('/catalog/products?type=course&pageSize=1');
      const slug = list.items[0].slug;
      const detail = await apiGet<{ course: { price: string; modules: unknown[] } }>(
        `/catalog/products/${slug}`,
      );
      await page.goto(`/${locale}/p/${slug}`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.curric li')).toHaveCount(detail.course.modules.length);
      await expect(page.locator('.person')).toBeVisible();
      await expect(page.locator('ta-buy-box .big')).toContainText(
        detail.course.price.replace(/\.00$/, ''),
      );
      const ld = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent()) ?? '[]',
      );
      expect(ld[0]['@type']).toBe('Course');
      expect(ld[0].offers.priceCurrency).toBe('SAR');
      expect(ld[1]['@type']).toBe('BreadcrumbList');
      await page.locator('.share-btn').click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/p/${slug} share`);
      await page.keyboard.press('Escape');
      await page.locator('#rel-h').scrollIntoViewIfNeeded();
      await expect(page.locator('ta-related-list .pcard').first()).toBeVisible();
    });

    test('book page: formats, print stepper, total, JSON-LD Book', async ({ page }) => {
      await page.goto(`/${locale}/p/science-stars-book`);
      await expect(page.locator('input[type=radio]')).toHaveCount(2);
      await expect(page.locator('input[type=radio]').first()).toBeChecked();
      await page
        .getByRole('button', { name: locale === 'ar' ? 'زيادة الكمية' : 'Increase quantity' })
        .click();
      await expect(page.locator('.stepper input')).toHaveValue('2');
      await expect(page.locator('.total')).toContainText('130');
      const ld = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent()) ?? '[]',
      );
      expect(ld[0]['@type']).toBe('Book');
      await expectNoA11yViolations(page, `/${locale}/p/science-stars-book`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('unknown product: unavailable state, noindex (client fallback)', async ({ page }) => {
      await page.goto(`/${locale}/p/no-such-product`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.gone')).toBeVisible();
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
    });
  });
}

test('@smoke prerendered product HTML carries the content before any script runs', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/ar/p/science-stars-book');
  await expect(page.locator('h1')).toContainText('نجوم العلوم');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://store.ta3lom.sa/ar/p/science-stars-book',
  );
  await ctx.close();
});
