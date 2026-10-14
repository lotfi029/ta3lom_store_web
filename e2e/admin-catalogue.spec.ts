import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { staffSignIn } from './support/auth';
import { archiveBySlug } from './support/admin-data';
import { pdf, png } from './support/files';

/** W-09 — the admin catalogue (#54–#62, #64–#66, #72–#80) on the real API; plan §6 "Admin catalogue". */
const PNG = png();
const PDF = pdf();

for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const stamp = () => `${locale}-${Date.now().toString(36)}`;

  async function fillGeneral(page: Page, slug: string, title: string) {
    await page.locator('#pe-slug').fill(slug);
    await page.locator('#pe-title-ar').fill(`${title} (اختبار)`);
    await page.locator('#pe-title-en').fill(`${title} (e2e)`);
    await page.locator('#pe-sum-ar').fill('ملخص قصير للاختبار.');
    await page.locator('#pe-sum-en').fill('A short e2e summary.');
    await page.locator('#pe-cat').selectOption({ index: 1 });
  }

  async function pickNewCover(page: Page) {
    await page
      .getByRole('button', { name: t('اختيار صورة الغلاف', 'Choose a cover image') })
      .first()
      .click();
    const dlg = page.getByRole('dialog');
    await dlg
      .locator('#mp-file')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
    await dlg.getByRole('button', { name: t('رفع', 'Upload') }).click();
    await expect(dlg.locator('.err')).toContainText(t('النص البديل', 'Alt text'));
    await dlg.locator('#mp-alt-ar').fill('غلاف تجريبي');
    await dlg.locator('#mp-alt-en').fill('A test cover');
    await dlg.getByRole('button', { name: t('رفع', 'Upload') }).click();
    await expect(page.locator('.cover img')).toBeVisible();
  }

  async function publish(page: Page) {
    await page.getByRole('button', { name: t('نشر', 'Publish'), exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: t('تأكيد', 'Confirm') })
      .click();
    await expect(page.locator('.meta ta-status-pill')).toHaveText(t('منشور', 'Published'));
  }

  test.describe(`admin catalogue /${locale}`, () => {
    const created: string[] = [];
    test.afterEach(async () => {
      for (const slug of created.splice(0)) await archiveBySlug(slug);
    });

    test('store manager creates and publishes a course with cover and curriculum → visible in the storefront', async ({
      page,
    }) => {
      const slug = `e2e-course-${stamp()}`;
      created.push(slug);
      await staffSignIn(page, locale, 'store_manager', '/admin/products');
      await expectNoA11yViolations(page, `/${locale}/admin/products`);
      await page.getByRole('link', { name: t('دورة جديدة', 'New course') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/products/new\\?type=course`));
      await page.locator('#pe-slug').fill('Bad Slug');
      await page.locator('form.panel button[type=submit]').first().click();
      await expect(page.locator('#pe-slug-err')).not.toBeEmpty();
      await fillGeneral(page, slug, 'دورة');
      await pickNewCover(page);
      await page.locator('form.panel button[type=submit]').first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/products/[0-9a-f-]{36}$`));
      await expect(page.locator('.meta ta-status-pill')).toHaveText(t('مسودة', 'Draft'));

      // Publishing an incomplete draft lists what's missing.
      await page.getByRole('button', { name: t('نشر', 'Publish'), exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('تأكيد', 'Confirm') })
        .click();
      await expect(page.locator('.err-box')).toBeVisible();

      await page.locator('#pe-price').fill('199');
      await page.locator('#pe-compare').fill('150');
      await page.locator('#pe-lessons').fill('6');
      await page.locator('#pe-minutes').fill('120');
      await page.locator('#pe-instr-ar').fill('هند الشمري');
      const courseForm = page.locator('form', { has: page.locator('#pe-price') });
      await courseForm.locator('button[type=submit]').click();
      await expect(page.locator('#pe-compare-err')).toContainText(
        t('أعلى من السعر', 'above the price'),
      );
      await page.locator('#pe-compare').fill('249');
      await courseForm.locator('button[type=submit]').click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));

      await page.getByRole('button', { name: t('إضافة وحدة', 'Add a module') }).click();
      await page.getByRole('button', { name: t('إضافة وحدة', 'Add a module') }).click();
      await page.locator('#mod-ar-0').fill('الوحدة الثانية');
      await page.locator('#mod-min-0').fill('30');
      await page.locator('#mod-ar-1').fill('الوحدة الأولى');
      await page.locator('#mod-min-1').fill('20');
      await page.locator('#mod-1-up').click();
      await expect(page.locator('#mod-ar-0')).toHaveValue('الوحدة الأولى');
      await page.getByRole('button', { name: t('حفظ المنهج', 'Save curriculum') }).click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));
      await expectNoA11yViolations(page, `/${locale}/admin/products/:id (course)`);

      await publish(page);
      await page.getByRole('button', { name: t('معاينة', 'Preview') }).click();
      await expect(page.locator('.prevbox ta-product-card')).toContainText(
        t('دورة (اختبار)', 'دورة (e2e)'),
      );

      await page.goto(`/${locale}/p/${slug}`);
      await expect(page.locator('h1')).toContainText(t('دورة (اختبار)', 'دورة (e2e)'));
    });

    test('a book with a digital file and print stock (formats, movements) → published', async ({
      page,
    }) => {
      const slug = `e2e-book-${stamp()}`;
      created.push(slug);
      await staffSignIn(page, locale, 'store_manager', '/admin/products/new?type=book');
      await fillGeneral(page, slug, 'كتاب');
      await pickNewCover(page);
      await page.locator('form.panel button[type=submit]').first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/products/[0-9a-f-]{36}$`));

      await page.locator('#pe-author-ar').fill('فريق الجمعية');
      await page.locator('#pe-pages').fill('120');
      await page
        .locator('form', { has: page.locator('#pe-author-ar') })
        .locator('button[type=submit]')
        .click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));

      await page
        .getByRole('button', { name: t('إضافة نسخة رقمية', 'Add a digital edition') })
        .click();
      const digital = page.locator('.fmt', { has: page.locator('summary') });
      await digital.locator('input[id^=f-price-]').fill('30');
      await digital.locator('summary').click();
      await digital
        .locator('input[type=file]')
        .setInputFiles({ name: 'book.pdf', mimeType: 'application/pdf', buffer: PDF });
      await digital.getByRole('button', { name: t('رفع', 'Upload') }).click();
      await expect(digital.locator('.ro')).toContainText(t('مرفوع', 'Uploaded'));
      await digital.getByRole('button', { name: new RegExp(t('حفظ', 'Save')) }).click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));

      await page
        .getByRole('button', { name: t('إضافة نسخة مطبوعة', 'Add a print edition') })
        .click();
      const print = page.locator('.fmt', { has: page.locator('input[id^=f-w-]') });
      await print.locator('input[id^=f-price-]').fill('60');
      await print.locator('input[id^=f-w-]').fill('400');
      await print.getByRole('button', { name: new RegExp(t('حفظ', 'Save')) }).click();
      await expect(page.locator('.stock')).toBeVisible();
      await page.locator('#mv-delta').fill('0');
      await page.getByRole('button', { name: t('تسجيل', 'Record'), exact: true }).click();
      await expect(page.locator('.stock .err')).toBeVisible();
      await page.locator('#mv-delta').fill('25');
      await page.getByRole('button', { name: t('تسجيل', 'Record'), exact: true }).click();
      await expect(page.locator('.nums')).toContainText('25');
      await expectNoA11yViolations(page, `/${locale}/admin/products/:id (book)`);

      await publish(page);
      await page.goto(`/${locale}/p/${slug}`);
      await expect(page.locator('h1')).toContainText(t('كتاب (اختبار)', 'كتاب (e2e)'));
      await expect(page.locator('ta-buy-box label.opt')).toHaveCount(2);
    });

    test('viewer: products read-only with the reason; categories and media gated (RUL-62)', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'viewer', '/admin/products');
      await expect(
        page.getByRole('button', { name: t('دورة جديدة', 'New course') }),
      ).toBeDisabled();
      await expect(page.locator('ta-requires').first()).toContainText(
        t('يتطلب دور مدير المتجر', 'Requires the store manager role'),
      );
      await page.locator('tbody tr a').first().click();
      await expect(page.locator('#pe-slug')).toBeDisabled();
      await expect(
        page
          .getByRole('button', { name: t('أرشفة', 'Archive') })
          .or(page.getByRole('button', { name: t('نشر', 'Publish'), exact: true })),
      ).toBeDisabled();
      await expectNoA11yViolations(page, `/${locale}/admin/products/:id (viewer)`);
      await page.goto(`/${locale}/admin/categories`);
      await expect(
        page.getByRole('button', { name: t('إضافة تصنيف', 'Add a category') }),
      ).toBeDisabled();
      await page.goto(`/${locale}/admin/media`);
      await expect(page.locator('#md-file')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/admin/media (viewer)`);
    });

    test('categories: create with slug validation; media library alt text (#72–#77)', async ({
      page,
    }) => {
      await staffSignIn(page, locale, 'store_manager', '/admin/categories');
      await page.getByRole('button', { name: t('إضافة تصنيف', 'Add a category') }).click();
      const dlg = page.getByRole('dialog');
      await dlg.locator('#ct-ar').fill('تصنيف اختبار');
      await dlg.locator('#ct-slug').fill('X');
      await dlg.locator('button[type=submit]').click();
      await expect(dlg.locator('#ct-slug-err')).not.toBeEmpty();
      const slug = `e2e-${stamp()}`;
      await dlg.locator('#ct-slug').fill(slug);
      await expectNoA11yViolations(page, `/${locale}/admin/categories dialog`);
      await dlg.locator('button[type=submit]').click();
      await expect(page.locator('tbody tr', { hasText: slug })).toBeVisible();

      await page.goto(`/${locale}/admin/media`);
      await page
        .locator('#md-file')
        .setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG });
      await page.locator('#md-alt-ar').fill('صورة');
      await page.locator('#md-alt-en').fill('An image');
      await page.getByRole('button', { name: t('رفع', 'Upload') }).click();
      await expect(page.locator('.toast')).toContainText(t('رُفع الملف', 'File uploaded'));
      await expectNoA11yViolations(page, `/${locale}/admin/media`);
    });
  });
}
