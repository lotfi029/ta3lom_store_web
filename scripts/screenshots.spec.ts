import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { freshMobile, otpFor, resetOtpLimits } from '../e2e/support/auth';

/**
 * C.2 prototype check (plan §7): the same seven screens of the built app and of the approved prototype
 * (docs/design/ta3lom-store-prototype.html), ar and en, 1440 and 375 px → docs/screenshots/. Run with
 * `npm run screenshots` (built output on :4320, real API). JPEG (quality 60) keeps the folder small.
 */
const OUT = join(process.cwd(), 'docs', 'screenshots');
const PROTO = `file://${join(process.cwd(), 'docs', 'design', 'ta3lom-store-prototype.html')}`;
const WIDTHS = [1440, 375] as const;

async function shoot(page: Page, name: string): Promise<void> {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: join(OUT, `${name.replace('{w}', String(w))}.jpg`),
      fullPage: true,
      type: 'jpeg',
      quality: 60,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const locale of ['ar', 'en'] as const) {
  test(`app ${locale}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);
    await page.goto(`/${locale}/`);
    await shoot(page, `app-${locale}-{w}-1-home`);
    await page.goto(`/${locale}/p/smart-study`);
    await expect(page.locator('h1')).toBeVisible();
    await shoot(page, `app-${locale}-{w}-2-course`);
    await page.locator('ta-buy-box .acts .b.primary').click();
    await page.goto(`/${locale}/p/science-stars-book`);
    await expect(page.locator('h1')).toBeVisible();
    await shoot(page, `app-${locale}-{w}-3-book`);
    await page.locator('ta-buy-box .acts .b.primary').click();
    await expect(page.locator('a.cartbtn .n')).toHaveText('2');
    await page.goto(`/${locale}/cart`);
    await expect(page.locator('.cline')).toHaveCount(2);
    await shoot(page, `app-${locale}-{w}-4-cart`);

    await page.goto(`/${locale}/checkout`);
    resetOtpLimits();
    const mobile = freshMobile();
    const started = Date.now() - 50;
    await page.locator('#otp-mobile').fill(mobile);
    await page.locator('#otp-mobile').press('Enter');
    await page.locator('#otp-code').fill(await otpFor(mobile, started));
    await page.locator('#co-name').fill(t('نورة العتيبي', 'Noura Alotaibi'));
    await page.locator('#co-email').fill('noura@example.com');
    await page.locator('#co-rname').fill(t('نورة العتيبي', 'Noura Alotaibi'));
    await page.locator('#co-rmobile').fill('0551234567');
    await page.locator('#co-city').fill(t('الرياض', 'Riyadh'));
    await page.locator('#co-short').fill('RRRD2929');
    await shoot(page, `app-${locale}-{w}-5-checkout`);
    await page.locator('#co-terms').check();
    await page.locator('.pay-btn').click();
    await expect(page).toHaveURL(/\/thanks\?t=/);
    await page
      .getByRole('button', { name: t('محاكاة الدفع (تطوير)', 'Simulate payment (dev)') })
      .click();
    await expect(page.locator('h1')).toContainText(t('شكرًا لك', 'Thank you'));
    await shoot(page, `app-${locale}-{w}-6-thanks`);
    await page.goto(`/${locale}/account/courses`);
    await expect(page.locator('.libi').first()).toBeVisible();
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.locator('.libi').first()).toBeVisible();
    await shoot(page, `app-${locale}-{w}-7-account`);
  });

  test(`prototype ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const go = async (route: string) => {
      await page.goto(`${PROTO}#/${locale}/${route}`);
      await page.waitForTimeout(400);
    };
    await go('');
    await shoot(page, `proto-${locale}-{w}-1-home`);
    await go('p/digital-teacher');
    await shoot(page, `proto-${locale}-{w}-2-course`);
    await go('p/science-stars-book');
    await shoot(page, `proto-${locale}-{w}-3-book`);
    await go('cart');
    await shoot(page, `proto-${locale}-{w}-4-cart`);
    await go('checkout');
    await shoot(page, `proto-${locale}-{w}-5-checkout`);
    await go('done');
    await shoot(page, `proto-${locale}-{w}-6-thanks`);
    await go('account');
    await shoot(page, `proto-${locale}-{w}-7-account`);
  });
}
