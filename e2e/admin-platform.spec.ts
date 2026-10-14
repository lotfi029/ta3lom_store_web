import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { freshMobile, staffSignIn } from './support/auth';
import { totp } from '../scripts/lib/totp.mjs';

/** W-08 — staff sign-in, the admin shell and the platform screens (#47–#52, #118–#128, #133) on the real API. */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`admin platform /${locale}`, () => {
    test('signed out → /admin/login with the return URL; wrong password; sign in → back to the screen', async ({
      page,
    }) => {
      await page.goto(`/${locale}/admin/settings`);
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/admin/login\\?returnUrl=%2Fadmin%2Fsettings`),
      );
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expectNoA11yViolations(page, `/${locale}/admin/login`);
      await page.locator('#al-email').fill('nobody@store-web.test');
      await page.locator('#al-password').fill('wrong-password');
      await page.locator('#al-password').press('Enter');
      await expect(page.locator('.form-error')).toBeVisible();
      await staffSignIn(page, locale, 'admin', '/admin/settings');
      await expect(page.locator('h1')).toHaveText(t('الإعدادات', 'Settings'));
    });

    test('the side nav follows the role: viewer reads settings with the reason; no team or audit (RUL-62)', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'viewer');
      const nav = page.locator('#admin-nav');
      await expect(nav.getByRole('link', { name: t('الإعدادات', 'Settings') })).toBeVisible();
      await expect(nav.getByRole('link', { name: t('فريق العمل', 'Team') })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: t('سجل التدقيق', 'Audit log') })).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin home (viewer)`);
      await nav.getByRole('link', { name: t('الإعدادات', 'Settings') }).click();
      await expect(page.locator('#set-shipping_flat_fee')).toHaveAttribute('readonly', '');
      await expect(page.locator('ta-requires').first()).toContainText(
        t('يتطلب دور مدير النظام', 'Requires the administrator role'),
      );
      await expectNoA11yViolations(page, `/${locale}/admin/settings (viewer)`);
      await page.goto(`/${locale}/admin/staff`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin$`));
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('team: create a member (one-time password once) → first sign-in enrols TOTP → reset TOTP (#123–#127)', async ({
      page,
      browser,
    }) => {
      await staffSignIn(page, locale, 'admin', '/admin/staff');
      await expectNoA11yViolations(page, `/${locale}/admin/staff`);
      const email = `e2e-new-${Date.now()}@store-web.test`;
      await page.getByRole('button', { name: t('إضافة عضو', 'Add a member') }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#st-email').fill(email);
      await dlg.locator('#st-name').fill(t('عضو جديد', 'New member'));
      await dlg.locator('button[type=submit]').click();
      await expect(dlg.locator('#st-roles-err')).toContainText(
        t('اختر دورًا', 'Choose at least one role'),
      );
      await dlg.getByLabel(t('اطّلاع فقط', 'Viewer')).check();
      await expectNoA11yViolations(page, `/${locale}/admin/staff create dialog`);
      await dlg.locator('button[type=submit]').click();
      const otp = page.getByTestId('one-time-password');
      await expect(otp).toBeVisible();
      const password = (await otp.textContent())!.trim();
      await page.getByRole('button', { name: t('تم', 'Done') }).click();
      const row = page.locator('tbody tr', { hasText: email });
      await expect(row).toContainText(t('بلا تحقق بخطوتين', 'No two-step verification'));

      const ctx = await browser.newContext(); // AxeBuilder needs a page from a context
      const other = await ctx.newPage();
      await other.goto(`/${locale}/admin/login`);
      await other.locator('#al-email').fill(email);
      await other.locator('#al-password').fill(password);
      await other.locator('#al-password').press('Enter');
      const secret = (await other.getByTestId('totp-secret').textContent())!.replace(/\s+/g, '');
      await expectNoA11yViolations(other, `/${locale}/admin/login enrol`);
      await other.locator('#al-code').fill(totp(secret));
      await other.locator('#al-code').press('Enter');
      await expect(other).toHaveURL(new RegExp(`/${locale}/admin$`));
      await ctx.close();

      await page.reload();
      await expect(row).not.toContainText(t('بلا تحقق بخطوتين', 'No two-step verification'));
      await row
        .getByRole('button', { name: new RegExp(t('إعادة تعيين التحقق', 'Reset two-step')) })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('تأكيد', 'Confirm') })
        .click();
      await expect(row).toContainText(t('بلا تحقق بخطوتين', 'No two-step verification'));
    });

    test('settings: admin saves a typed value; invalid input is refused (#118–#119)', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'admin', '/admin/settings');
      const input = page.locator('#set-low_stock_default_threshold');
      const before = await input.inputValue();
      const save = page.locator('li', { has: input }).getByRole('button');
      await input.fill('1.5');
      await save.click();
      await expect(page.locator('#set-low_stock_default_threshold-err')).toContainText(
        t('عددًا صحيحًا', 'whole number'),
      );
      await input.fill(String(Number(before) + 1));
      await save.click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));
      await page.reload();
      await expect(page.locator('#set-low_stock_default_threshold')).toHaveValue(
        String(Number(before) + 1),
      );
      await page.locator('#set-low_stock_default_threshold').fill(before);
      await page
        .locator('li', { has: page.locator('#set-low_stock_default_threshold') })
        .getByRole('button')
        .click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));

      await page.goto(`/${locale}/admin/audit`);
      await page.locator('#au-entity').fill('setting');
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('tbody tr').first()).toContainText('setting');
      await page.locator('tbody tr').first().getByRole('button').click();
      await expect(page.locator('tbody pre').first()).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/admin/audit`);
    });

    test('templates: preview fills variables; test send shows the rendered text (#120–#122)', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'admin', '/admin/templates');
      await page.locator('#tp-pick').selectOption('order_paid/sms/ar');
      await expect(page.locator('.prev .pbody')).toContainText('[reference]');
      await expectNoA11yViolations(page, `/${locale}/admin/templates`);
      await page.locator('#tp-to').fill(freshMobile());
      await page.getByRole('button', { name: t('إرسال تجريبي', 'Send a test') }).click();
      await expect(page.locator('.sent')).toBeVisible();
    });
  });
}
