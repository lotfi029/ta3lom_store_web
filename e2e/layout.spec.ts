import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';

/** Header, footer, skip link, language switch, theme, 404. Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke layout /${locale}`, () => {
    test('header: store nav, search, cart, sign-in, language, theme', async ({ page }) => {
      await page.goto(`/${locale}/`);
      const header = page.locator('header.hdr');
      await expect(header.getByRole('navigation').first()).toBeVisible();
      await expect(header.locator('.nav a[href$="/#projects"]')).toBeVisible();
      await expect(header.locator('.brand')).toHaveAttribute('href', /^https:\/\/ta3lom\.sa/);
      await expect(header.locator('a.cartbtn')).toHaveAttribute('href', `/${locale}/cart`);
      await expect(header.locator('a.signin')).toHaveAttribute('href', `/${locale}/login`);
      await expect(header.locator('a.lang')).toHaveAttribute(
        'href',
        locale === 'ar' ? '/en/' : '/ar/',
      );
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toBeVisible();
    });

    test('theme toggle flips data-theme and is a pressed-state button', async ({ page }) => {
      await page.goto(`/${locale}/`);
      const toggle = page.locator('.theme-toggle');
      const before = await page.locator('html').getAttribute('data-theme');
      await toggle.click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
      await expect(toggle).toHaveAttribute('aria-pressed', /true|false/);
    });

    test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Tab');
      const skip = page.locator('.skip-link');
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });

    test('search submits to the home listing (?q=)', async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.locator('#hdr-q').fill('سقيا');
      await page.locator('#hdr-q').press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/\\?q=`));
    });

    test('mobile: burger opens the drawer, Escape closes it, no horizontal scroll at 320 px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(`/${locale}/`);
      await expectNoHorizontalScroll(page);
      const burger = page.locator('button.burger');
      await expect(burger).toBeVisible();
      await burger.click();
      await expect(page.locator('#mobile-nav')).toBeVisible();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expectNoA11yViolations(page, `/${locale}/ drawer`);
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-nav')).toBeHidden();
      await expect(burger).toBeFocused();
    });

    test('404 for an unknown path, noindex, keeps the chrome', async ({ page }) => {
      await page.goto(`/${locale}/no-such-page`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(page.locator('header.hdr')).toBeVisible();
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
    });

    test('language switch keeps the path', async ({ page }) => {
      await page.goto(`/${locale}/no-such-page`);
      await expect(page.locator('a.lang')).toHaveAttribute(
        'href',
        `/${locale === 'ar' ? 'en' : 'ar'}/no-such-page`,
      );
    });
  });
}
