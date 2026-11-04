import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { resetStub } from './support/api';

test.beforeEach(resetStub);

/** Header, footer, skip link, language switch, theme, 404. Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke layout /${locale}`, () => {
    test('header: utility row, big search, cart, sign-in, language, theme (Option C)', async ({
      page,
    }) => {
      await page.goto(`/${locale}/`);
      const header = page.locator('header.hdr');
      const util = page.locator('.util');
      await expect(util).toContainText(locale === 'ar' ? 'ترخيص' : 'Licence');
      await expect(util.locator('.ulink')).toHaveAttribute('href', /^https:\/\/ta3lom\.sa/);
      await expect(header.locator('form[role=search] #hdr-q')).toBeVisible();
      // Empty cart: the button says "السلة" without a total; the accessible name says it is empty.
      await expect(header.locator('a.cartbtn .ctot')).toHaveCount(0);
      await expect(header.locator('.brand')).toHaveAttribute('href', /^https:\/\/ta3lom\.sa/);
      await expect(header.locator('a.cartbtn')).toHaveAttribute('href', `/${locale}/cart`);
      await expect(header.locator('a.signin')).toHaveAttribute('href', `/${locale}/login`);
      await expect(page.locator('.util a.lang')).toHaveAttribute(
        'href',
        locale === 'ar' ? '/en/' : '/ar/',
      );
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toBeVisible();
    });

    test('theme toggle flips data-theme and is a pressed-state button', async ({ page }) => {
      await page.goto(`/${locale}/`);
      const toggle = page.locator('.acts .theme-toggle');
      const before = await page.locator('html').getAttribute('data-theme');
      await toggle.click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
      await expect(toggle).toHaveAttribute('aria-pressed', /true|false/);
    });

    test('phones: logo and actions on one row, theme toggle in the menu, header away on scroll down', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const brand = await page.locator('.hdr .brand').boundingBox();
      const cart = await page.locator('.hdr .cartbtn').boundingBox();
      expect(Math.abs(brand!.y + brand!.height / 2 - (cart!.y + cart!.height / 2))).toBeLessThan(12);
      await expect(page.locator('.acts .theme-toggle')).toBeHidden();
      await page.locator('.burger').click();
      const before = await page.locator('html').getAttribute('data-theme');
      await page.locator('.mtheme .theme-toggle').click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
      await page.locator('.burger').click();
      await page.locator('.burger').blur();
      for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120);
      await expect(page.locator('.hdr')).toHaveClass(/away/);
      await page.mouse.wheel(0, -120);
      await expect(page.locator('.hdr')).not.toHaveClass(/away/);
      await expectNoHorizontalScroll(page);
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

    test('search submits to the home listing (?q=); an empty search drops q', async ({ page }) => {
      await page.goto(`/${locale}/cart`);
      await page.locator('#hdr-q').fill('سقيا');
      await page.locator('#hdr-q').press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/\\?q=`));
      await expect(page.locator('#hdr-q')).toHaveValue('سقيا');
      await page.locator('#hdr-q').fill('  ');
      await page.locator('#hdr-q').press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
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
      await expect(page.locator('.util a.lang')).toHaveAttribute(
        'href',
        `/${locale === 'ar' ? 'en' : 'ar'}/no-such-page`,
      );
    });
  });
}
