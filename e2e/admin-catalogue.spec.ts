import { expect, type Page, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { staffSignIn } from './support/auth';
import { hideE2eCatalogue } from './support/cleanup';
import { png } from './support/png';

/**
 * W-M5/W-M6 — the catalogue admin on the real API: a category with general gifts, a project with options → publish →
 * visible in the store; a slug change keeps the old link as a redirect; a viewer reads only.
 */
// What this spec publishes would change the storefront the other specs check against the prerendered pages.
test.afterAll(async () => {
  test.setTimeout(90_000); // a staff sign-in may wait for the next TOTP step
  await hideE2eCatalogue();
});

for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const toast = (page: Page) => page.locator('ta-toast');

  test.describe(`admin catalogue /${locale}`, () => {
    test('category → project with options → publish → public page; slug change redirects', async ({
      page,
      browser,
    }) => {
      const id = `${locale}-${Date.now().toString(36)}`;
      await staffSignIn(page, locale, 'store_manager', '/admin/categories');
      await expect(page.locator('h1')).toHaveText(t('التصنيفات', 'Categories'));
      await expectNoA11yViolations(page, `/${locale}/admin/categories`);

      // Category
      await page.getByRole('button', { name: t('إضافة تصنيف', 'Add a category') }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#ct-slug').fill('Bad Slug');
      await dlg.locator('button[type=submit]').click();
      await expect(dlg.locator('#ct-ar-err')).not.toBeEmpty();
      await expect(dlg.locator('#ct-slug-err')).not.toBeEmpty();
      await dlg.locator('#ct-ar').fill(`تصنيف ${id}`);
      await dlg.locator('#ct-en').fill(`Category ${id}`);
      await dlg.locator('#ct-slug').fill(`e2e-cat-${id}`);
      await dlg.getByLabel(t('يقبل التبرع العام', 'Accepts general donations')).check();
      await expectNoA11yViolations(page, `/${locale}/admin/categories dialog`);
      await dlg.locator('button[type=submit]').click();
      await expect(toast(page)).toContainText(t('حُفظت', 'saved'));
      const catRow = page.locator('ta-reorder-list li', { hasText: `تصنيف ${id}` });
      await expect(catRow).toBeVisible();
      await expect(catRow).toContainText(t('يقبل التبرع العام', 'Accepts general donations'));

      // Project (draft) with a cover uploaded from the picker
      await page.goto(`/${locale}/admin/projects/new`);
      await expect(page.locator('h1')).toHaveText(t('مشروع جديد', 'New project'));
      await page.locator('#pe-cat').selectOption({ label: `تصنيف ${id}` });
      await page.locator('#pe-slug').fill(`e2e-prj-${id}`);
      await page.locator('#pe-tar').fill(`مشروع ${id}`);
      await page.locator('#pe-ten').fill(`Project ${id}`);
      await page.locator('#pe-sar').fill('ملخص قصير للمشروع.');
      await page.locator('#pe-bar').fill('## القصة\n\nنص **عريض** ورابط [هنا](https://ta3lom.sa).');
      await page.getByRole('button', { name: t('اختيار صورة', 'Choose an image') }).click();
      const picker = page.getByRole('dialog');
      await picker.locator('#pe-mp-up-file').setInputFiles({
        name: 'cover.png',
        mimeType: 'image/png',
        buffer: png(),
      });
      await picker.getByRole('button', { name: t('رفع', 'Upload') }).click();
      await expect(picker.locator('.err')).toBeVisible(); // Arabic alt text is required
      await picker.locator('#pe-mp-up-alt-ar').fill('صورة اختبار');
      await picker.getByRole('button', { name: t('رفع', 'Upload') }).click();
      await expect(page.locator('.imgf img')).toBeVisible();
      await page.getByRole('button', { name: t('إنشاء كمسودة', 'Create as draft') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/projects/[0-9a-f-]{36}$`));
      await expect(page.locator('h1')).toHaveText(`مشروع ${id}`);
      // Nothing to donate to yet → publish lists what is missing.
      await expect(page.locator('.missing')).toContainText(
        t('خيار تبرع نشط', 'An active donation option'),
      );
      await expectNoA11yViolations(page, `/${locale}/admin/projects/:id`);

      // Options: the client checks rows first (API-3), then the full replacement is saved.
      await page.getByRole('button', { name: t('إضافة خيار', 'Add an option') }).click();
      await page.getByRole('button', { name: t('حفظ الخيارات', 'Save options') }).click();
      await expect(page.locator('.orow [aria-invalid=true]').first()).toBeFocused();
      const rows = page.locator('.orow');
      await rows.nth(0).locator('input').nth(0).fill('سهم كامل');
      await rows.nth(0).locator('input').nth(2).fill('٥٠');
      await page.getByRole('button', { name: t('إضافة خيار', 'Add an option') }).click();
      await rows.nth(1).locator('input').nth(0).fill('نصف سهم');
      await rows.nth(1).locator('input').nth(1).fill('Half share');
      await rows.nth(1).locator('input').nth(2).fill('25');
      await rows
        .nth(1)
        .getByRole('button', { name: new RegExp(t('للأعلى', 'up')) })
        .click();
      await expect(rows.nth(0).locator('input').nth(0)).toHaveValue('نصف سهم');
      await page.getByRole('button', { name: t('حفظ الخيارات', 'Save options') }).click();
      await expect(toast(page)).toContainText(t('حُفظت', 'saved'));
      await expect(page.locator('.missing')).toHaveCount(0);

      // Preview, then publish
      await page.getByRole('button', { name: t('معاينة', 'Preview') }).click();
      const pv = page.getByRole('dialog');
      await expect(pv.locator('h2').first()).toHaveText(t(`مشروع ${id}`, `Project ${id}`));
      await expect(pv.locator('ta-markdown strong')).toHaveText('عريض');
      await pv.getByRole('button', { name: t('إغلاق', 'Close') }).click();
      await page.getByRole('button', { name: t('نشر', 'Publish'), exact: true }).click();
      await expect(toast(page)).toContainText(t('نُشر', 'published'));
      await expect(page.locator('ta-status-pill').first()).toContainText(t('منشور', 'Published'));

      // Public: not prerendered (E-1) → client-rendered from the API.
      await page.goto(`/${locale}/p/e2e-prj-${id}`);
      await expect(page.locator('h1')).toHaveText(t(`مشروع ${id}`, `Project ${id}`));
      await expect(
        page.getByRole('radio', { name: new RegExp(t('نصف سهم', 'Half share')) }),
      ).toBeVisible();

      // A slug change keeps the old link as a redirect.
      await page.goBack();
      await expect(page.locator('#pe-slug')).toHaveValue(`e2e-prj-${id}`);
      await page.locator('#pe-slug').fill(`e2e-prj-${id}-v2`);
      await page.getByRole('button', { name: t('حفظ البيانات', 'Save details') }).click();
      await expect(toast(page)).toContainText(t('حُفظت', 'saved'));
      await expect(page.locator('bdi.mono', { hasText: `e2e-prj-${id}` }).first()).toBeVisible();
      // A fresh browser: this one may reuse the old slug's cached 200 (the API sends max-age=60).
      const ctx = await browser.newContext();
      const visitor = await ctx.newPage();
      await visitor.goto(`/${locale}/p/e2e-prj-${id}`);
      await expect(visitor).toHaveURL(new RegExp(`/${locale}/p/e2e-prj-${id}-v2$`));
      await expect(visitor.locator('h1')).toHaveText(t(`مشروع ${id}`, `Project ${id}`));
      await ctx.close();
    });

    test('unsaved edits ask before leaving; the projects list filters by status and text', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'admin', '/admin/projects');
      await expect(page.locator('h1')).toHaveText(t('المشاريع', 'Projects'));
      await expectNoA11yViolations(page, `/${locale}/admin/projects`);
      await page.locator('#pf-status').selectOption('published');
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      const first = page.locator('tbody tr').first();
      await expect(first).toContainText(t('منشور', 'Published'));
      await first.getByRole('link').click();
      await expect(page.locator('#pe-tar')).not.toHaveValue('');
      await page.locator('#pe-sar').fill('تعديل لم يُحفظ');
      page.once('dialog', (d) => void d.dismiss());
      await page
        .locator('#admin-nav')
        .getByRole('link', { name: t('المشاريع', 'Projects') })
        .click();
      await expect(page.locator('#pe-sar')).toHaveValue('تعديل لم يُحفظ');
      page.once('dialog', (d) => void d.accept());
      await page
        .locator('#admin-nav')
        .getByRole('link', { name: t('المشاريع', 'Projects') })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/projects$`));
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('a viewer reads the catalogue but cannot change it', async ({ page }) => {
      await staffSignIn(page, locale, 'viewer', '/admin/categories');
      await expect(
        page.getByRole('button', { name: t('إضافة تصنيف', 'Add a category') }),
      ).toBeDisabled();
      await expect(page.locator('ta-requires').first()).not.toBeEmpty();
      await page.goto(`/${locale}/admin/media`);
      await expect(page.locator('h1')).toHaveText(t('الوسائط', 'Media'));
      await expect(page.locator('#md-file')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin/media (viewer)`);
    });
  });
}
