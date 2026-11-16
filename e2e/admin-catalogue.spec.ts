import { expect, type Page, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { staff, staffSignIn } from './support/auth';
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
      await page.locator('#pe-sar').fill('ملخص قصير للمشروع.');
      await page.locator('#pe-bar').fill('## القصة\n\nنص **عريض** ورابط [هنا](https://ta3lom.sa).');
      // W-A3: the English fields sit behind the عربي / English tabs.
      await page.getByRole('tab', { name: 'English' }).click();
      await page.locator('#pe-ten').fill(`Project ${id}`);
      await page.getByRole('tab', { name: 'العربية' }).click();
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
      await expect(page.locator('.cover img')).toBeVisible();
      await page.getByRole('button', { name: t('إنشاء كمسودة', 'Create as draft') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/projects/[0-9a-f-]{36}$`));
      await expect(page.locator('h1')).toHaveText(`مشروع ${id}`);
      // Nothing to donate to yet → publish lists what is missing.
      await expect(page.locator('.missing')).toContainText(
        t('خيار تبرع نشط', 'An active donation option'),
      );
      await expectNoA11yViolations(page, `/${locale}/admin/projects/:id`);

      // Options: the client checks rows first, then the full replacement is saved.
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
      await expect(page.locator('ta-admin-badge').first()).toContainText(t('منشور', 'Published'));

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
      // W-A2: status views replace the status select; counts come from the API's paged totals.
      await expect(
        page.getByRole('listitem').filter({ hasText: t('منشورة', 'Published') }),
      ).toContainText(/\d+/);
      await page.getByRole('button', { name: t('منشور', 'Published'), exact: true }).click();
      await expect(
        page.getByRole('button', { name: t('منشور', 'Published'), exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      const first = page.locator('tbody tr').first();
      await expect(first).toContainText(t('منشور', 'Published'));
      const title = (await first.getByRole('link').textContent())!.trim();
      await page.locator('#pf-q').fill(title);
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(
        page.getByRole('list', { name: t('الفلاتر المفعّلة', 'Active filters') }),
      ).toContainText(title);
      await expect(page.locator('tbody tr').first().getByRole('link')).toHaveText(title);
      await expect(first).toContainText(t('منشور', 'Published'));
      await first.getByRole('link').click();
      await expect(page.locator('#pe-tar')).not.toHaveValue('');
      await page.locator('#pe-sar').fill('تعديل لم يُحفظ');
      page.once('dialog', (d) => void d.dismiss());
      await page
        .locator('#admin-nav')
        .getByRole('link', { name: t('المشاريع', 'Projects'), exact: true })
        .click();
      await expect(page.locator('#pe-sar')).toHaveValue('تعديل لم يُحفظ');
      page.once('dialog', (d) => void d.accept());
      await page
        .locator('#admin-nav')
        .getByRole('link', { name: t('المشاريع', 'Projects'), exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/projects$`));
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('bulk publish from the list: one call per project, partial failure lists the missing items (W-A2)', async ({
      page,
    }) => {
      test.setTimeout(120_000); // two staff sign-ins (API + UI) may each wait for the next TOTP step
      const c = await staff('admin');
      const tok = `${Date.now().toString(36)}${locale}`;
      const { body: list } = await c.call('GET', '/v1/admin/projects?status=published&pageSize=1');
      const { body: donor } = await c.call('GET', `/v1/admin/projects/${list.items[0].id}`);
      const make = async (suffix: string, cover: string | null) => {
        const r = await c.call('POST', '/v1/admin/projects', {
          categoryId: donor.categoryId,
          slug: `e2e-prj-bulk-${tok}-${suffix}`,
          titleAr: `مشروع جماعي ${tok} ${suffix}`,
          titleEn: `Bulk project ${tok} ${suffix}`,
          summaryAr: 'ملخص',
          summaryEn: null,
          bodyAr: 'قصة المشروع',
          bodyEn: null,
          coverAssetId: cover,
          allowOpenAmount: true,
          minAmount: null,
          badge: null,
          sort: 900,
          seoTitleAr: null,
          seoTitleEn: null,
          seoDescAr: null,
          seoDescEn: null,
          version: null,
        });
        expect(r.status).toBe(201);
      };
      await make('a', donor.coverAssetId);
      await make('b', null);

      await staffSignIn(page, locale, 'admin', '/admin/projects');
      await page.locator('#pf-q').fill(tok);
      await page.getByRole('button', { name: t('تطبيق', 'Apply') }).click();
      await expect(page.locator('tbody tr')).toHaveCount(2);
      await page
        .getByRole('checkbox', {
          name: t('تحديد كل مشاريع الصفحة', 'Select every project on this page'),
        })
        .check();
      const bar = page.getByRole('region', {
        name: t('إجراءات على المحدد', 'Actions on the selection'),
      });
      await expect(bar).toContainText(t('تم تحديد 2', '2 selected'));
      await bar.getByRole('button', { name: t('نشر', 'Publish') }).click();
      const result = page.getByRole('dialog');
      await expect(result.locator('h2')).toHaveText(t('نُشر 1 من 2', 'Published 1 of 2'));
      await expect(result).toContainText(t('صورة الغلاف', 'A cover image'));
      await expectNoA11yViolations(page, `/${locale}/admin/projects bulk result`);
      await result.getByRole('button', { name: t('إغلاق', 'Close') }).click();
      await expect(page.locator('tbody tr').filter({ hasText: `${tok} a` })).toContainText(
        t('منشور', 'Published'),
      );
      await expect(
        page.getByRole('region', { name: t('إجراءات على المحدد', 'Actions on the selection') }),
      ).toHaveCount(0);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('table')).toHaveCount(0);
      await expect(
        page.getByRole('list', { name: t('المشاريع', 'Projects'), exact: true }).getByRole('listitem'),
      ).toHaveCount(2);
      await expectNoA11yViolations(page, `/${locale}/admin/projects (390 cards)`);
    });

    test('editor: save bar names the dirty section, publish waits for it, Ctrl+S saves, 422 updates the requirements (W-A3)', async ({
      page,
    }) => {
      test.setTimeout(120_000); // two staff sign-ins and four axe passes
      const c = await staff('admin');
      const tok = `${Date.now().toString(36)}${locale}`;
      const { body: cats } = await c.call('GET', '/v1/admin/categories');
      const r = await c.call('POST', '/v1/admin/projects', {
        categoryId: cats.find((x: { isActive: boolean }) => x.isActive).id,
        slug: `e2e-prj-ed-${tok}`,
        titleAr: `مشروع محرر ${tok}`,
        titleEn: null,
        summaryAr: 'ملخص',
        summaryEn: null,
        bodyAr: 'قصة',
        bodyEn: null,
        coverAssetId: null,
        allowOpenAmount: true,
        minAmount: null,
        badge: null,
        sort: 900,
        seoTitleAr: null,
        seoTitleEn: null,
        seoDescAr: null,
        seoDescEn: null,
        version: null,
      });
      expect(r.status).toBe(201);
      await staffSignIn(page, locale, 'admin', `/admin/projects/${r.body.id}`);
      const reqs = page.getByRole('region', { name: t('متطلبات النشر', 'Publish requirements') });
      await expect(
        reqs.getByRole('listitem').filter({ hasText: t('صورة الغلاف', 'A cover image') }),
      ).toHaveClass(/warn/);

      await page.locator('#pe-sar').fill('ملخص معدّل');
      const bar = page.getByRole('region', { name: t('حفظ التغييرات', 'Save changes') });
      await expect(bar).toContainText(t('«التفاصيل»', '“Details”'));
      const publish = page.getByRole('button', { name: t('نشر', 'Publish'), exact: true });
      await expect(publish).toBeDisabled();
      await expectNoA11yViolations(page, `/${locale}/admin/projects/:id (dirty)`);
      await page.keyboard.press('Control+s');
      await expect(bar).toHaveCount(0);
      await expect(publish).toBeEnabled();
      await publish.click();
      await expect(page.getByRole('alert')).toContainText(t('صورة الغلاف', 'A cover image'));

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('h1')).toHaveCount(1);
      await expectNoA11yViolations(page, `/${locale}/admin/projects/:id (390)`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('a viewer reads the catalogue but cannot change it', async ({ page }) => {
      await staffSignIn(page, locale, 'viewer', '/admin/categories');
      await expect(
        page.getByRole('button', { name: t('إضافة تصنيف', 'Add a category') }),
      ).toBeDisabled();
      await expect(page.locator('ta-requires').first()).not.toBeEmpty();
      await page.goto(`/${locale}/admin/projects`);
      await page.locator('tbody input[type=checkbox]').first().check();
      const bulk = page.getByRole('region', {
        name: t('إجراءات على المحدد', 'Actions on the selection'),
      });
      await expect(bulk.getByRole('button', { name: t('نشر', 'Publish') })).toBeDisabled();
      await expect(
        bulk.getByRole('button', { name: t('نشر', 'Publish') }),
      ).toHaveAccessibleDescription(/.+/);
      await page.goto(`/${locale}/admin/media`);
      await expect(page.locator('h1')).toHaveText(t('الوسائط', 'Media'));
      await expect(page.locator('#md-file')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin/media (viewer)`);
    });
  });
}
