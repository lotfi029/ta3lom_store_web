import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { resetStub } from './support/api';
import { donate } from './support/donate';
import { freshMobile, signIn } from './support/auth';

test.beforeEach(resetStub);

/** W-M4 — donor account: donations list + detail, profile, export, sign out everywhere, delete. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke account /${locale}`, () => {
    test('donations list → detail, profile save, export, delete account', async ({ page }) => {
      const mobile = freshMobile();
      await signIn(page, locale, mobile, '/account/donations');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.acct-empty')).toBeVisible();

      const ref = await donate(mobile, locale);
      await page.reload();
      const row = page.locator('table.tbl tbody tr', { hasText: ref });
      await expect(row).toBeVisible();
      await expectNoA11yViolations(page);
      await row.getByRole('link').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account/donations/${ref}$`));
      await expect(page.locator('table.tbl tbody tr')).toHaveCount(1);
      await expect(page.locator('tfoot')).toContainText('50');
      // API-2: a lower-case reference in the URL still opens the donation.
      await page.goto(`/${locale}/account/donations/${ref.toLowerCase()}`);
      await expect(page.locator('tfoot')).toContainText('50');

      await page.goto(`/${locale}/account/profile`);
      await page.locator('#pf-name').fill('اسم محدّث');
      await page.locator('form.pform button[type=submit]').click();
      await expect(page.locator('ta-toast')).toContainText(locale === 'ar' ? 'حُفظت' : 'saved');
      await page.locator('.acct-side a').first().click();
      await expect(page.locator('.who b')).toHaveText('اسم محدّث');
      await page.goto(`/${locale}/account/profile`);
      await expectNoA11yViolations(page);
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1280, height: 800 });

      const download = page.waitForEvent('download');
      await page.locator('.rights button').first().click();
      const file = await (await download).path();
      const json = JSON.parse(readFileSync(file, 'utf8'));
      expect(json.donations.map((d: { reference: string }) => d.reference)).toContain(ref);

      await page.locator('.rights button.danger').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('button[type=submit]')).toBeDisabled();
      await dialog.locator('#del-word').fill(locale === 'ar' ? 'حذف' : 'DELETE');
      await dialog.locator('button[type=submit]').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
      await expect(page.locator('a.signin')).toBeVisible();
    });

    test('sign out everywhere ends the session', async ({ page }) => {
      await signIn(page, locale, freshMobile(), '/account/profile');
      await page.locator('.rights button').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
      await page.goto(`/${locale}/account/donations`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login`));
    });
  });
}
