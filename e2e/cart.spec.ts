import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { moveStock, printAvailable, setFormatPrice } from './support/admin-data';
import { apiGet } from './support/api';
import { signIn } from './support/auth';

/** W-05 — buy boxes and the cart (#10–#15) on the real API. Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`cart /${locale}`, () => {
    test('course + print book ×2 → cart: badge, lines, quantity, totals, remove, empty', async ({
      page,
    }) => {
      const courses = await apiGet<{ items: { slug: string }[] }>(
        '/catalog/products?type=course&pageSize=1',
      );
      await page.goto(`/${locale}/p/${courses.items[0].slug}`);
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('.toast')).toContainText(t('أُضيف إلى السلة', 'Added to cart'));
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');

      await page.goto(`/${locale}/p/science-stars-book`);
      await page.getByRole('button', { name: t('زيادة الكمية', 'Increase quantity') }).click();
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('2');

      await page.goto(`/${locale}/cart`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(page.locator('.cline')).toHaveCount(2);
      const book = page.locator('.cline', { has: page.locator('.stepper') });
      await expect(book.locator('output')).toHaveText('2');
      await expect(page.locator('.sumbox .r').nth(1)).toContainText('25'); // flat shipping (RUL-26)
      await expectNoA11yViolations(page, `/${locale}/cart with lines`);

      await book.getByRole('button', { name: t('زيادة الكمية', 'Increase quantity') }).click();
      await book.getByRole('button', { name: t('زيادة الكمية', 'Increase quantity') }).click();
      await expect(book.locator('output')).toHaveText('4');
      await expect(book.locator('.lp')).toContainText('260'); // 4 × 65 after the debounced PATCH
      await page.reload();
      await expect(
        page.locator('.cline', { has: page.locator('.stepper') }).locator('output'),
      ).toHaveText('4');

      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1280, height: 800 });

      for (let i = 0; i < 2; i++) await page.locator('.rm').first().click();
      await expect(page.locator('.empty')).toBeVisible();
      await expect(page.locator('a.cartbtn .n')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/cart empty`);
    });

    test('empty the cart in one go (#15)', async ({ page }) => {
      await page.goto(`/${locale}/p/letters-tales`);
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await page.goto(`/${locale}/cart`);
      await page.getByRole('button', { name: t('إفراغ السلة', 'Empty the cart') }).click();
      await expect(page.locator('.empty')).toBeVisible();
      await expect(page.locator('a.cartbtn .n')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.empty')).toBeVisible();
    });

    test('the same course twice is refused with a link to the cart (RUL-13)', async ({ page }) => {
      await page.goto(`/${locale}/p/smart-study`);
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('.toast')).toContainText(
        t('موجودة في سلتك', 'already in your cart'),
      );
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
    });

    test('a guest cart is kept after signing in (RUL-17)', async ({ page }) => {
      await page.goto(`/${locale}/p/letters-tales`);
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await signIn(page, locale, undefined, '/cart');
      await expect(page.locator('.cline')).toHaveCount(1);
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
    });

    test('price changed between visits shows the banner (RUL-15)', async ({ page }) => {
      await page.goto(`/${locale}/p/formative-guide`);
      await page.locator('ta-buy-box .acts .b.primary').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await page.goto(`/${locale}/cart`);
      await expect(page.locator('.cline')).toHaveCount(1);
      const old = await setFormatPrice('formative-guide', 'print', '47.00');
      try {
        await page.goto(`/${locale}/`);
        await page.locator('a.cartbtn').click();
        await expect(page.locator('.banner.warn')).toBeVisible();
        await expect(page.locator('.cline .lp')).toContainText('47');
        await expectNoA11yViolations(page, `/${locale}/cart price changed`);
      } finally {
        await setFormatPrice('formative-guide', 'print', old);
      }
    });

    test('out of stock: the print format is disabled and digital is offered (RUL-30)', async ({
      page,
    }) => {
      const available = await printAvailable('study-planner');
      await moveStock('study-planner', -available);
      try {
        await page.goto(`/${locale}/p/study-planner`);
        await expect(page.locator('.opt.off')).toBeVisible();
        await expect(page.locator('.opt.off')).toContainText(t('نفدت الكمية', 'Out of stock'));
        await expectNoA11yViolations(page, `/${locale}/p/study-planner out of stock`);
      } finally {
        await moveStock('study-planner', available);
      }
    });

    test('mobile: the sticky buy bar adds to the cart', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 740 });
      await page.goto(`/${locale}/p/science-stars-book`);
      const bar = page.locator('.stickybar');
      await expect(bar).toBeVisible();
      await bar.locator('button').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await expectNoHorizontalScroll(page);
    });
  });
}
