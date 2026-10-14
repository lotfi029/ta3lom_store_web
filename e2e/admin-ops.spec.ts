import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { freshMobile, staffSignIn } from './support/auth';
import { buy, customerClient } from './support/purchase';

/** W-10 — admin operations (#53, #78–#80, #85–#88, #94–#99, #117, #129–#132); plan §6 "Admin ops". */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`admin ops /${locale}`, () => {
    test('dashboard: sales figures, low stock and alerts; 320 px', async ({ page }) => {
      await staffSignIn(page, locale, 'admin');
      await expect(page.locator('h1')).toHaveText(t('لوحة إدارة المتجر', 'Store admin'));
      await expect(page.locator('.stats li')).toHaveCount(4);
      await expectNoA11yViolations(page, `/${locale}/admin dashboard`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('fulfilment: packing slip → ship with tracking → deliver (#95–#98, RUL-40)', async ({
      page,
    }) => {
      const c = await customerClient(freshMobile());
      const ref = await buy(c, [{ slug: 'science-stars-book', format: 'print' }]);
      await staffSignIn(page, locale, 'fulfilment', '/admin/shipments');
      const card = page.locator('.ships > li', { hasText: ref });
      await expect(page.locator('.ships > li').first()).toBeVisible();
      // The queue is oldest first and paged: move on until this order's shipment shows.
      for (let i = 0; i < 20 && !(await card.isVisible()); i++) {
        await page.getByRole('button', { name: t('التالي', 'Next') }).click();
        await page.waitForTimeout(300);
      }
      await expect(card).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/admin/shipments`);
      const slip = page.waitForEvent('download');
      await card
        .getByRole('button', { name: new RegExp(t('إيصال التجهيز', 'Packing slip')) })
        .click();
      expect((await slip).suggestedFilename()).toBe(`packing-slip-${ref}.pdf`);

      await card.getByRole('button', { name: new RegExp(`^${t('شحن', 'Ship')}`) }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: t('تأكيد', 'Confirm') }).click();
      await expect(dlg.locator('.err')).toBeVisible();
      await dlg.locator('#sh-tracking').fill('SA123456789');
      await expectNoA11yViolations(page, `/${locale}/admin/shipments ship dialog`);
      await dlg.getByRole('button', { name: t('تأكيد', 'Confirm') }).click();
      await expect(card).toHaveCount(0);

      await page.getByRole('button', { name: t('تم الشحن', 'Shipped') }).click();
      const shipped = page.locator('.ships > li', { hasText: ref });
      await expect(page.locator('.ships > li').first()).toBeVisible();
      for (let i = 0; i < 20 && !(await shipped.isVisible()); i++) {
        await page.getByRole('button', { name: t('التالي', 'Next') }).click();
        await page.waitForTimeout(300);
      }
      await expect(shipped).toContainText('SA123456789');
      await shipped
        .getByRole('button', { name: new RegExp(t('تأكيد التسليم', 'Confirm delivery')) })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('تأكيد', 'Confirm') })
        .click();
      await page.getByRole('button', { name: t('تم التسليم', 'Delivered') }).click();
      const delivered = page.locator('.ships > li', { hasText: ref });
      await expect(page.locator('.ships > li').first()).toBeVisible();
      for (let i = 0; i < 20 && !(await delivered.isVisible()); i++) {
        await page.getByRole('button', { name: t('التالي', 'Next') }).click();
        await page.waitForTimeout(300);
      }
      await expect(delivered).toBeVisible();
    });

    test('finance cancels an unpaid order; store manager sees Cancel disabled with its reason (#85–#87, RUL-29/62)', async ({
      page,
      browser,
    }) => {
      const c = await customerClient(freshMobile());
      const ref = await buy(c, [{ slug: 'formative-guide', format: 'print' }], { pay: false });

      const ctx = await browser.newContext();
      const manager = await ctx.newPage();
      await staffSignIn(manager, locale, 'store_manager', `/admin/orders/${ref}`);
      await expect(
        manager.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }),
      ).toBeDisabled();
      await expect(manager.locator('#ord-cancel-why')).toContainText(
        t('يتطلب دور المالية', 'Requires the finance role'),
      );
      await ctx.close();

      await staffSignIn(page, locale, 'finance', '/admin/orders');
      await page.locator('#ao-q').fill(ref);
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/admin/orders`);
      await page.locator('tbody tr a').click();
      await expect(page.locator('.meta ta-status-pill').first()).toHaveText(
        t('بانتظار الدفع', 'Awaiting payment'),
      );
      await expectNoA11yViolations(page, `/${locale}/admin/orders/:ref`);
      await page.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: t('تأكيد الإلغاء', 'Confirm cancellation') }).click();
      await expect(dlg.locator('.err')).toBeVisible();
      await dlg.locator('#ord-reason').fill('e2e: customer asked');
      await dlg.getByRole('button', { name: t('تأكيد الإلغاء', 'Confirm cancellation') }).click();
      await expect(page.locator('.meta ta-status-pill').first()).toHaveText(t('ملغى', 'Cancelled'));
      await expect(
        page.getByRole('button', { name: t('إلغاء الطلب', 'Cancel order') }),
      ).toHaveCount(0);
    });

    test('viewer sees operations disabled; no reports (RUL-62)', async ({ page }) => {
      await staffSignIn(page, locale, 'viewer', '/admin/stock');
      await expect(
        page.locator('#admin-nav').getByRole('link', { name: t('التقارير', 'Reports') }),
      ).toHaveCount(0);
      await page.locator('tbody tr button').first().click();
      await expect(page.locator('#sm-delta')).toBeDisabled();
      await expect(page.locator('#sm-why')).toContainText(t('يتطلب', 'Requires'));
      await expectNoA11yViolations(page, `/${locale}/admin/stock (viewer)`);
      await page.goto(`/${locale}/admin/reports`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin$`));
    });

    test('stock: restock then adjust back (#78–#80, RUL-30)', async ({ page }) => {
      await staffSignIn(page, locale, 'store_manager', '/admin/stock');
      const row = page.locator('tbody tr', { hasText: 'BK-SCIENCE-STAR-P' });
      const before = Number(await row.locator('td').nth(1).textContent());
      await row.getByRole('button').click();
      await page.locator('#sm-delta').fill('5');
      await page.getByRole('button', { name: t('تسجيل', 'Record'), exact: true }).click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));
      await expect(row.locator('td').nth(1)).toHaveText(String(before + 5));
      await expectNoA11yViolations(page, `/${locale}/admin/stock`);
      await page.locator('#sm-delta').fill('-5');
      await page.locator('#sm-reason').selectOption('adjustment');
      await page.getByRole('button', { name: t('تسجيل', 'Record'), exact: true }).click();
      await expect(row.locator('td').nth(1)).toHaveText(String(before));
    });

    test('customers: lookup, block with a reason, unblock (#129–#132, RUL-61)', async ({
      page,
    }) => {
      const mobile = freshMobile();
      await customerClient(mobile);
      await staffSignIn(page, locale, 'finance', '/admin/customers');
      await page.locator('#cu-q').fill('noura');
      await page.getByRole('button', { name: t('بحث', 'Search') }).click();
      await expect(page.locator('#cu-err')).not.toBeEmpty();
      await page.locator('#cu-q').fill(mobile);
      await page.getByRole('button', { name: t('بحث', 'Search') }).click();
      await page.locator('tbody tr').first().getByRole('button').click();
      await expectNoA11yViolations(page, `/${locale}/admin/customers`);
      await page.getByRole('button', { name: t('إيقاف الحساب', 'Block account') }).click();
      await page.locator('#cu-reason').fill('e2e');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('تأكيد', 'Confirm') })
        .click();
      await expect(page.locator('tbody tr').first()).toContainText(t('موقوف', 'Blocked'));
      await page.getByRole('button', { name: t('إعادة التفعيل', 'Unblock') }).click();
      await expect(page.locator('tbody tr').first()).toContainText(t('نشط', 'Active'));
    });

    test('reports: sales table and CSV download (#117)', async ({ page }) => {
      await staffSignIn(page, locale, 'finance', '/admin/reports');
      await page.getByRole('button', { name: t('عرض', 'Show') }).click();
      await expect(page.locator('table.atbl')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/admin/reports`);
      const csv = page.waitForEvent('download');
      await page.getByRole('button', { name: t('تنزيل CSV', 'Download CSV') }).click();
      expect((await csv).suggestedFilename()).toMatch(
        /^sales-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
      );
    });

    test('download reset by grant id (#94, RUL-41)', async ({ page }) => {
      const c = await customerClient(freshMobile());
      const ref = await buy(c, [{ slug: 'letters-tales', format: 'digital' }]);
      const books = await c.call('GET', '/v1/me/books');
      const grant = books.body.downloads[0].grantId as string;
      await c.call('POST', `/v1/me/downloads/${grant}/link`);
      await staffSignIn(page, locale, 'store_manager', `/admin/orders/${ref}`);
      await page.locator('#gr-id').fill(grant);
      await page.locator('#gr-reason').fill('e2e: broken file');
      await page.getByRole('button', { name: t('إعادة الضبط', 'Reset') }).click();
      await expect(page.locator('.toast')).toContainText('5');
      const after = await c.call('GET', '/v1/me/books');
      expect(after.body.downloads[0].downloadCount).toBe(0);
    });
  });
}
