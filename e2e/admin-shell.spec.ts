import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { API } from './support/api';
import { staffSignIn } from './support/auth';

/** The redesigned admin shell (W-A1, docs/admin-redesign/02 §2–3): rail, command palette, phone bars, More page. */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`admin shell /${locale}`, () => {
    test('rail ≤ 1100px keeps named links; Ctrl+K routes a reference, a mobile and a project name', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'admin');
      const nav = page.locator('#admin-nav');
      await expect(nav.getByRole('link', { name: t('التبرعات', 'Donations') })).toBeVisible();
      await expect(nav.getByText(t('المالية', 'Finance'))).toBeVisible();

      await page.setViewportSize({ width: 1024, height: 800 });
      for (const [ar, en] of [
        ['الرئيسية', 'Home'],
        ['المشاريع', 'Projects'],
        ['الوسائط', 'Media'],
      ])
        await expect(nav.getByRole('link', { name: t(ar, en) })).toBeVisible();
      expect((await nav.boundingBox())!.width).toBeLessThanOrEqual(73);
      await expectNoA11yViolations(page, `/${locale}/admin rail`);
      await page.setViewportSize({ width: 1440, height: 900 });

      const palette = page.getByRole('combobox');
      await page.keyboard.press('Control+k');
      await expect(palette).toBeFocused();
      await expectNoA11yViolations(page, `/${locale}/admin palette`);
      await palette.fill('t3-26-000001');
      await palette.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/orders/T3-26-000001$`));

      await page.keyboard.press('Control+k');
      await palette.fill('0551234567');
      await palette.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/orders\\?mobile=0551234567$`));
      await expect(page.locator('#ao-mobile')).toHaveValue('0551234567');

      const { items } = (await (await fetch(`${API}/catalog/projects?pageSize=1`)).json()) as {
        items: { titleAr: string }[];
      };
      const word = items[0]!.titleAr.split(' ')[0]!;
      await page.keyboard.press('Control+k');
      await palette.fill(word);
      const option = page.getByRole('option', { name: items[0]!.titleAr });
      await expect(option).toBeVisible();
      await option.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/projects/[0-9a-f-]{36}$`));
    });

    test('phone 390: bottom tab bar, page title, More page; a viewer sees + disabled with the reason', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await staffSignIn(page, locale, 'viewer');
      const bar = page.getByRole('navigation', { name: t('التنقل السريع', 'Quick navigation') });
      await expect(bar).toBeVisible();
      await expect(page.locator('#admin-nav')).toBeHidden();
      const plus = bar.getByRole('button', { name: t('مشروع جديد', 'New project') });
      await expect(plus).toBeDisabled();
      await expect(plus).toHaveAccessibleDescription(/.+/);
      await bar.getByRole('link', { name: t('المشاريع', 'Projects') }).click();
      await expect(page.locator('.ptitle')).toHaveText(t('المشاريع', 'Projects'));
      await bar.getByRole('link', { name: t('المزيد', 'More') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/menu$`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('button', { name: t('تسجيل الخروج', 'Sign out') })).toBeVisible();
      await expect(page.getByRole('link', { name: t('سجل التدقيق', 'Audit log') })).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin/menu (viewer, 390)`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}/admin/menu`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin$`));
    });
  });
}
