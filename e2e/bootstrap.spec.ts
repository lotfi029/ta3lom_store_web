import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';

test.describe('@smoke bootstrap', () => {
  for (const locale of ['ar', 'en'] as const) {
    test(`/${locale}/ is prerendered with the right language and direction`, async ({ page }) => {
      await page.goto(`/${locale}/`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('h1')).toHaveCount(1);
      await page.setViewportSize({ width: 320, height: 700 });
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
    });
  }

  test('the bare domain redirects to /ar/', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ar\/$/);
  });
});
