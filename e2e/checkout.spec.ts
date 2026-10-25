import { expect, test, type Page } from '@playwright/test';
import { Client } from '../scripts/lib/store-api-client.mjs';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { apiGet, onStub, resetStub } from './support/api';
import { freshMobile, otpFor, resetOtpChallenges } from './support/auth';

interface Card {
  slug: string;
  titleAr: string;
  titleEn: string | null;
  fromAmount: string | null;
  allowOpenAmount: boolean;
}

test.beforeEach(resetStub);

const name = (c: Card, locale: 'ar' | 'en') =>
  locale === 'en' && c.titleEn ? c.titleEn : c.titleAr;

/** Fills the cart with the three line kinds from the UI: option × 2, an open amount, a category gift via quick donate. */
async function threeLines(page: Page, locale: 'ar' | 'en') {
  const { items } = await apiGet<{ items: Card[] }>('/catalog/projects?page=1&pageSize=12');
  const withOptions = items.find((c) => c.fromAmount !== null)!;
  const amountOnly = items.find((c) => c.fromAmount === null && c.allowOpenAmount)!;
  await page.goto(`/${locale}/`);
  const a = page.locator('ta-project-card', { hasText: name(withOptions, locale) });
  await a.locator('.chip').first().click();
  await a.getByRole('button', { name: /^(زيادة|Increase)/ }).click();
  await a.locator('button.add').click();
  await expect(page.locator('a.cartbtn .n')).toHaveText('1');
  const b = page.locator('ta-project-card', { hasText: name(amountOnly, locale) });
  await b.locator('input[inputmode=decimal]').fill('٧٥');
  await b.locator('button.add').click();
  await expect(page.locator('a.cartbtn .n')).toHaveText('2');

  // Quick donate (header button): a category gift → straight to checkout.
  await page.locator('header .acts > button.quick').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#qd-cat').selectOption({ index: 1 });
  await dialog.locator('.preset').first().click();
  await expectNoA11yViolations(page, `/${locale} quick donate`);
  await dialog.getByRole('button', { name: locale === 'ar' ? 'تبرع الآن' : 'Donate now' }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));
}

for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke donate /${locale}`, () => {
    test('three line kinds → checkout (sign in, contact) → pending order page; contact saved to /me', async ({
      page,
    }) => {
      await threeLines(page, locale);
      // C-3: "تبرع" with other donations already in the cart — the summary lists them all and says so.
      await expect(page.locator('.others')).toBeVisible();
      await expect(page.locator('.sumlines li')).toHaveCount(3);

      const mobile = freshMobile();
      resetOtpChallenges();
      const started = Date.now() - 50;
      await page.locator('#otp-mobile').fill(mobile);
      await page.locator('#otp-mobile').press('Enter');
      await page.locator('#otp-code').fill(await otpFor(mobile, started));
      await expect(page.locator('#co-name')).toBeVisible();
      await expect(page.locator('.sumlines li')).toHaveCount(3);
      await expect(page.locator('#co-saved')).toBeVisible();

      const email = `donor-${Date.now()}@example.com`;
      await page.locator('#co-name').fill('  سارة المتبرعة ');
      await page.locator('#co-email').fill(email.toUpperCase());
      await expectNoA11yViolations(page, `/${locale}/checkout`);
      await page.locator('button.pay-btn').click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/orders/T3-\\d{2}-\\d{6}$`));
      await expect(page.locator('.osec .card h2')).toContainText(
        locale === 'ar' ? 'تم تسجيل تبرعك' : 'registered',
      );
      expect(page.url()).not.toContain('t=');
      await expect(page.locator('meta[name=referrer]')).toHaveAttribute('content', 'no-referrer');
      await expect(page.locator('a.cartbtn .n')).toHaveCount(0);
      await expectNoA11yViolations(page);

      if (!onStub) {
        // C-7: the name and e-mail given at checkout were saved to the profile (trimmed, e-mail lower-cased).
        resetOtpChallenges();
        const c = new Client();
        const t0 = Date.now() - 50;
        await c.call('POST', '/v1/auth/otp/request', { mobile, locale });
        const s = await c.call('POST', '/v1/auth/otp/verify', {
          mobile,
          code: await otpFor(mobile, t0),
        });
        c.token = s.body.accessToken;
        const me = await c.call('GET', '/v1/me');
        expect(me.body.fullName).toBe('سارة المتبرعة');
        expect(me.body.email).toBe(email.toLowerCase());
      }
    });

    test('cart page: three kinds, edit an amount, remove, clear', async ({ page }) => {
      await threeLines(page, locale);
      await page.goto(`/${locale}/cart`);
      await expect(page.locator('ta-cart-line')).toHaveCount(3);
      await expect(page.locator('h1')).toHaveCount(1);
      const amountLine = page.locator('ta-cart-line').nth(1);
      await amountLine.locator('input[inputmode=decimal]').fill('120');
      await amountLine.locator('button.upd').click();
      await expect(amountLine.locator('.lp')).toContainText('120');
      await expectNoA11yViolations(page);
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
      await page.locator('ta-cart-line').first().locator('button.rm').click();
      await expect(page.locator('ta-cart-line')).toHaveCount(2);
      await page.locator('.cfoot button.rm').click();
      await page.getByRole('dialog').locator('button.danger').click();
      await expect(page.locator('.empty')).toBeVisible();
      await expect(page.locator('a.cartbtn .n')).toHaveCount(0);
    });
  });
}
