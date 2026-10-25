import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { freshMobile, staffSignIn } from './support/auth';
import { donate } from './support/donate';

/** W-M5/W-M6 — dashboard, orders and donors on the real API (contract 15 §2.8). */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`admin operations /${locale}`, () => {
    test('finance finds a pending order (lower-case reference, API-2) and cancels it', async ({
      page,
    }) => {
      const mobile = freshMobile();
      const ref = await donate(mobile, locale);
      await staffSignIn(page, locale, 'finance');
      await expect(page.locator('h1')).toHaveText(t('لوحة إدارة المتجر', 'Store admin'));
      await expect(page.locator('.stats')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/admin dashboard`);

      await page.goto(`/${locale}/admin/orders`);
      await page.locator('#ao-from').fill('2026-12-31');
      await page.locator('#ao-to').fill('2026-01-01');
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('#ao-range-err')).not.toBeEmpty();
      await page.locator('#ao-from').fill('');
      await page.locator('#ao-to').fill('');
      await page.locator('#ao-ref').fill(ref.toLowerCase());
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/admin/orders`);
      await page.locator('tbody tr a').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/orders/${ref}$`));
      await expect(page.locator('h1')).toContainText(ref);
      await expect(page.locator('table.atbl tbody tr')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/admin/orders/:ref`);

      await page.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }).click();
      await expect(page.locator('ta-toast')).toContainText(t('أُلغي الطلب', 'Order cancelled'));
      await expect(page.locator('ta-status-pill').first()).toContainText(t('ملغى', 'Cancelled'));
      await expect(
        page.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }),
      ).toHaveCount(0);
    });

    test('a store manager blocks and unblocks a donor; a viewer cannot', async ({
      page,
      browser,
    }) => {
      const mobile = freshMobile();
      const ref = await donate(mobile, locale);
      await staffSignIn(page, locale, 'store_manager', '/admin/donors');
      await page.locator('#ad-q').fill(mobile);
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/admin/donors`);
      await page.locator('tbody tr a').click();
      await expect(page.locator('table.atbl')).toContainText(ref);
      await expectNoA11yViolations(page, `/${locale}/admin/donors/:id`);
      const donorUrl = page.url();

      await page.getByRole('button', { name: t('إيقاف الحساب', 'Block account') }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('إيقاف الحساب', 'Block account') })
        .click();
      await expect(page.locator('ta-status-pill').first()).toContainText(t('موقوف', 'Blocked'));
      await page.getByRole('button', { name: t('إعادة التفعيل', 'Unblock') }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('إعادة التفعيل', 'Unblock') })
        .click();
      await expect(page.locator('ta-status-pill').first()).toContainText(t('نشط', 'Active'));

      const ctx = await browser.newContext();
      const viewer = await ctx.newPage();
      await staffSignIn(viewer, locale, 'viewer');
      await viewer.goto(donorUrl);
      await expect(
        viewer.getByRole('button', { name: t('إيقاف الحساب', 'Block account') }),
      ).toBeDisabled();
      await ctx.close();
    });
  });
}
