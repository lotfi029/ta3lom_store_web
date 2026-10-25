import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { freshMobile, staffSignIn } from './support/auth';
import { totp } from '../scripts/lib/totp.mjs';

/** Staff sign-in, the admin shell and the platform screens (settings, templates, audit, team) on the real API (R5). */
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

    test('the side nav follows the role: a viewer reads the catalogue and orders; no settings, team, templates or audit', async ({
      page,
    }) => {
      const me = page.waitForRequest((r) => r.url().endsWith('/v1/admin/me'));
      await staffSignIn(page, locale, 'viewer');
      await me; // the shell reads the current roles
      const nav = page.locator('#admin-nav');
      for (const [ar, en] of [
        ['المشاريع', 'Projects'],
        ['الطلبات', 'Orders'],
        ['المتبرعون', 'Donors'],
      ])
        await expect(nav.getByRole('link', { name: t(ar, en) })).toBeVisible();
      for (const [ar, en] of [
        ['الإعدادات', 'Settings'],
        ['فريق العمل', 'Team'],
        ['قوالب الرسائل', 'Message templates'],
        ['سجل التدقيق', 'Audit log'],
      ])
        await expect(nav.getByRole('link', { name: t(ar, en) })).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin home (viewer)`);
      await page.goto(`/${locale}/admin/settings`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin$`));
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('team: create a member (one-time password once) → first sign-in sets up TOTP → forced password change → reset TOTP', async ({
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
      await expectNoA11yViolations(other, `/${locale}/admin/login TOTP setup`);
      await other.locator('#al-code').fill(totp(secret));
      await other.locator('#al-code').press('Enter');
      // C-6: the one-time password must be changed first; every other screen sends back here, also after a reload.
      await expect(other).toHaveURL(new RegExp(`/${locale}/admin/password$`));
      await expect(other.locator('h1')).toHaveText(t('تغيير كلمة المرور', 'Change password'));
      await other.reload();
      await expect(other).toHaveURL(new RegExp(`/${locale}/admin/password$`));
      await other.goto(`/${locale}/admin/projects`);
      await expect(other).toHaveURL(new RegExp(`/${locale}/admin/password$`));
      await expectNoA11yViolations(other, `/${locale}/admin/password (forced)`);
      await other.locator('#ap-current').fill(password);
      await other.locator('#ap-new').fill('short');
      await other.locator('#ap-confirm').fill('short');
      await other.locator('#ap-confirm').press('Enter');
      await expect(other.locator('.form-error li').first()).toBeVisible(); // auth.password_weak reasons
      const next = `E2e-${Date.now()}-strong-pass`;
      await other.locator('#ap-new').fill(next);
      await other.locator('#ap-confirm').fill(next);
      await other.locator('#ap-confirm').press('Enter');
      await expect(other).toHaveURL(new RegExp(`/${locale}/admin$`));
      await expect(other.locator('h1')).toHaveText(t('لوحة إدارة المتجر', 'Store admin'));
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

    test('settings: admin saves a typed value; invalid input is refused', async ({ page }) => {
      await staffSignIn(page, locale, 'admin', '/admin/settings');
      const input = page.locator('#set-cart_max_lines');
      const before = await input.inputValue();
      const save = page.locator('li', { has: input }).getByRole('button');
      await input.fill('1.5');
      await save.click();
      await expect(page.locator('#set-cart_max_lines-err')).toContainText(
        t('عددًا صحيحًا', 'whole number'),
      );
      const changed = String(Number(before) >= 50 ? Number(before) - 1 : Number(before) + 1);
      await input.fill(changed);
      await save.click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));
      await page.reload();
      await expect(page.locator('#set-cart_max_lines')).toHaveValue(changed);
      await page.locator('#set-cart_max_lines').fill(before);
      await page
        .locator('li', { has: page.locator('#set-cart_max_lines') })
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

    test('templates: preview fills variables; test send shows the rendered text', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'admin', '/admin/templates');
      await page.locator('#tp-pick').selectOption('otp/sms/ar');
      await expect(page.locator('.prev .pbody')).toContainText('[code]');
      await expectNoA11yViolations(page, `/${locale}/admin/templates`);
      await page.locator('#tp-to').fill(freshMobile());
      await page.getByRole('button', { name: t('إرسال تجريبي', 'Send a test') }).click();
      await expect(page.locator('.sent')).toBeVisible();
    });
  });
}
