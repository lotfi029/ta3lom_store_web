import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { freshMobile, otpFor, resetOtpChallenges, signIn, staff } from './support/auth';

/** W-04 — OTP sign-in (#16–#20) against the real API. Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`sign-in /${locale}`, () => {
    test('OTP: wrong number, wrong code with attempts left, then the right code', async ({
      page,
    }) => {
      await page.goto(`/${locale}/login?returnUrl=/cart`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expectNoA11yViolations(page, `/${locale}/login`);
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1280, height: 800 });

      await page.locator('#otp-mobile').fill('0112345678');
      await page.locator('#otp-mobile').press('Enter');
      await expect(page.locator('#otp-mobile')).toHaveAttribute('aria-invalid', 'true');

      const mobile = freshMobile();
      resetOtpChallenges();
      const started = Date.now() - 50;
      await page.locator('#otp-mobile').fill(mobile);
      await page
        .getByRole('button', { name: locale === 'ar' ? 'أرسل الرمز' : 'Send code' })
        .click();
      await expect(page.locator('#otp-code')).toBeFocused();
      await expect(page.locator('.sent')).toContainText(mobile.slice(-3));
      await expectNoA11yViolations(page, `/${locale}/login code step`);

      const code = await otpFor(mobile, started);
      const wrong = code === '000000' ? '111111' : '000000';
      await page.locator('#otp-code').fill(wrong);
      await expect(page.locator('[role=alert]')).toContainText('4');

      await page.locator('#otp-code').fill(code);
      await expect(page).toHaveURL(new RegExp(`/${locale}/cart`));
      await expect(page.locator('ta-account-menu')).toBeVisible();
    });

    test('the session survives a reload (refresh cookie) and /login sends a signed-in visitor on', async ({
      page,
    }) => {
      await signIn(page, locale);
      await page.reload();
      await expect(page.locator('ta-account-menu')).toBeVisible();
      await page.goto(`/${locale}/login?returnUrl=/cart`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/cart`));
    });

    test('sign out, and sign out everywhere', async ({ page, browser }) => {
      const mobile = await signIn(page, locale);
      // A second "device" with its own session.
      const other = await browser.newContext();
      const p2 = await other.newPage();
      await signIn(p2, locale, mobile);

      await page.locator('.acc-btn').click();
      await expectNoA11yViolations(page, `/${locale} account menu`);
      await page
        .getByRole('button', {
          name: locale === 'ar' ? 'الخروج من كل الأجهزة' : 'Sign out everywhere',
        })
        .click();
      await expect(page.locator('a.signin')).toBeVisible();
      await p2.reload();
      await expect(p2.locator('a.signin')).toBeVisible();

      await signIn(page, locale, mobile);
      await page.locator('.acc-btn').click();
      await page
        .getByRole('button', { name: locale === 'ar' ? 'تسجيل الخروج' : 'Sign out', exact: true })
        .click();
      await expect(page.locator('a.signin')).toBeVisible();
      await page.reload();
      await expect(page.locator('a.signin')).toBeVisible();
      await other.close();
    });

    test('rate limited (mocked 429) shows the wait', async ({ page }) => {
      await page.route('**/v1/auth/otp/request', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/problem+json',
          body: JSON.stringify({ code: 'otp.rate_limited', status: 429, retryAfterSeconds: 540 }),
        }),
      );
      await page.goto(`/${locale}/login`);
      await page.locator('#otp-mobile').fill(freshMobile());
      await page.locator('#otp-mobile').press('Enter');
      await expect(page.locator('[role=alert]')).toContainText('9');
    });

    test('a blocked customer is told to contact the association (RUL-61)', async ({ page }) => {
      const mobile = await signIn(page, locale);
      await page.locator('.acc-btn').click();
      await page
        .getByRole('button', { name: locale === 'ar' ? 'تسجيل الخروج' : 'Sign out', exact: true })
        .click();
      const finance = await staff('finance');
      const found = await finance.call('GET', `/v1/admin/customers?mobile=${mobile}`);
      const id = (found.body.items ?? found.body)[0].id;
      expect(
        (await finance.call('POST', `/v1/admin/customers/${id}/block`, { reason: 'e2e' })).status,
      ).toBeLessThan(300);

      await page.goto(`/${locale}/login`);
      resetOtpChallenges();
      const started = Date.now() - 50;
      await page.locator('#otp-mobile').fill(mobile);
      await page.locator('#otp-mobile').press('Enter');
      await page.locator('#otp-code').fill(await otpFor(mobile, started));
      await expect(page.locator('[role=alert]')).toContainText(
        locale === 'ar' ? 'تواصل مع الجمعية' : 'Contact the association',
      );
      await finance.call('POST', `/v1/admin/customers/${id}/unblock`, {});
    });
  });
}
