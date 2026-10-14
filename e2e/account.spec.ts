import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { freshMobile, signIn } from './support/auth';
import { buy, customerClient, shipOrder } from './support/purchase';

/** W-07 — the customer account (#21–#32, #35–#39, #46) on the real API. Purchases are set up through the API. */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  /** A customer who already bought `items` (paid through the dev trigger), signed in on `page`. */
  async function customerWith(
    page: Page,
    items: Parameters<typeof buy>[1],
    path = '/account/courses',
  ) {
    const mobile = freshMobile();
    const client = await customerClient(mobile);
    const ref = items.length ? await buy(client, items) : '';
    await signIn(page, locale, mobile, path);
    return { mobile, ref, client };
  }

  test.describe(`account /${locale}`, () => {
    test('signed out → sign in → account; empty tabs; one h1; 320 px', async ({ page }) => {
      await page.goto(`/${locale}/account/books`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?returnUrl=%2Faccount%2Fbooks`));
      await signIn(page, locale, freshMobile(), '/account/courses');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(t('حسابي', 'My account'));
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(page.locator('.acct-side a[aria-current=page]')).toContainText(
        t('دوراتي', 'My courses'),
      );
      await expect(page.locator('.acct-empty')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/account/courses empty`);
      await page.locator('.acct-side a', { hasText: t('الطلبات', 'Orders') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account/orders$`));
      await expect(page.locator('.acct-empty')).toBeVisible();
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
    });

    test('My courses: access being prepared → Start opens the LMS link (#29, RUL-42)', async ({
      page,
    }) => {
      await page.route('**/learn/**', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>LMS</title><h1>LMS</h1>',
        }),
      );
      await customerWith(page, [{ slug: 'qudrat-prep' }]);
      const card = page.locator('.libi').first();
      await expect(card).toContainText(t('قدرات', 'aptitude'));
      for (let i = 0; i < 10 && !(await card.locator('button').isVisible()); i++) {
        await page.waitForTimeout(1000);
        await page.reload();
      }
      await expect(card.locator('[role=progressbar]')).toHaveAttribute('aria-valuenow', '0');
      await expectNoA11yViolations(page, `/${locale}/account/courses`);
      await card.getByRole('button', { name: t('ابدأ', 'Start') }).click();
      await expect(page).toHaveURL(/\/learn\/qudrat-prep\?t=/);
    });

    test('My books: download (signed link, 5 → 4 left, RUL-41); shipment preparing → shipped with tracking', async ({
      page,
    }) => {
      const { ref } = await customerWith(
        page,
        [
          { slug: 'letters-tales', format: 'digital' },
          { slug: 'science-stars-book', format: 'print', quantity: 2 },
        ],
        '/account/books',
      );
      const dl = page.locator('.libi.dl').first();
      await expect(dl).toContainText(t('تبقّى 5 من 5', '5 of 5 downloads left'));
      const ship = page.locator('.libi.ship').first();
      await expect(ship).toContainText(t('قيد التجهيز', 'Preparing'));
      await expect(ship).toContainText('× 2');
      await expectNoA11yViolations(page, `/${locale}/account/books`);

      const download = page.waitForEvent('download');
      await dl.getByRole('button', { name: new RegExp(t('تنزيل', 'Download')) }).click();
      expect((await download).suggestedFilename()).toBe('letters-tales.pdf');
      await page.goto(`/${locale}/account/books`);
      await expect(page.locator('.libi.dl').first()).toContainText(
        t('تبقّى 4 من 5', '4 of 5 downloads left'),
      );

      await shipOrder(ref, 'SA290017734');
      await page.reload();
      await expect(page.locator('.libi.ship').first()).toContainText(t('تم الشحن', 'Shipped'));
      await expect(page.locator('.libi.ship').first()).toContainText('SA290017734');
    });

    test('Orders: list → detail → invoice PDF (#35–#37)', async ({ page }) => {
      const { ref } = await customerWith(
        page,
        [{ slug: 'formative-guide', format: 'digital' }],
        '/account/orders',
      );
      const row = page.locator('.tbl tbody tr', { hasText: ref });
      await expect(row).toContainText(t('مكتمل', 'Completed')); // digital-only orders are fulfilled at payment
      await expectNoA11yViolations(page, `/${locale}/account/orders`);
      await row.getByRole('link').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/account/orders/${ref}$`));
      await expect(page.locator('.tbl tbody tr')).toHaveCount(1);
      await expect(page.locator('.totals .t')).toContainText('45');
      const invoice = page.locator('.docs li').first();
      for (
        let i = 0;
        i < 10 &&
        !(await invoice
          .getByRole('button')
          .isVisible()
          .catch(() => false));
        i++
      ) {
        await page.waitForTimeout(1000);
        await page.reload();
      }
      await expectNoA11yViolations(page, `/${locale}/account/orders/${ref}`);
      const download = page.waitForEvent('download');
      await invoice.getByRole('button').click();
      expect((await download).suggestedFilename()).toMatch(/^INV-.*\.pdf$/);
    });

    test('Profile: edit details, address book (National Address), export JSON', async ({
      page,
    }) => {
      await customerWith(page, [], '/account/profile');
      await page.locator('#pf-name').fill(t('سارة الأحمد', 'Sara Alahmad'));
      await page.locator('#pf-email').fill('sara@example.com');
      await page.locator('form.pform button[type=submit]').click();
      await expect(page.locator('.toast')).toContainText(t('حُفظت التغييرات', 'Changes saved'));
      await expect(page.locator('.who b')).toHaveText(t('سارة الأحمد', 'Sara Alahmad'));
      await page.reload();
      await expect(page.locator('#pf-name')).toHaveValue(t('سارة الأحمد', 'Sara Alahmad'));

      await page.getByRole('button', { name: t('إضافة عنوان', 'Add an address') }).click();
      await page.locator('#ad-rname').fill('Sara');
      await page.locator('#ad-rmobile').fill('0551234567');
      await page.locator('#ad-city').fill(t('بريدة', 'Buraydah'));
      await page.locator('#ad-short').fill('QBR2929');
      await page.locator('form.addr-form button[type=submit]').click();
      await expect(page.locator('#ad-short-err')).toContainText('RRRD2929');
      await page.locator('#ad-short').fill('qbra2929');
      await page.locator('form.addr-form button[type=submit]').click();
      await expect(page.locator('.addrs li')).toHaveCount(1);
      await expect(page.locator('.addrs li')).toContainText('QBRA2929');
      await expect(page.locator('.addrs li')).toContainText(t('الافتراضي', 'Default'));
      await expectNoA11yViolations(page, `/${locale}/account/profile`);

      await page
        .locator('.addrs li')
        .getByRole('button', { name: new RegExp(t('تعديل', 'Edit')) })
        .click();
      await page.locator('#ad-city').fill(t('الرياض', 'Riyadh'));
      await page.locator('form.addr-form button[type=submit]').click();
      await expect(page.locator('.addrs li')).toContainText(t('الرياض', 'Riyadh'));
      await page
        .locator('.addrs li')
        .getByRole('button', { name: new RegExp(t('حذف', 'Remove')) })
        .click();
      await expect(page.locator('.addrs li')).toHaveCount(0);

      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: t('تصدير بياناتي', 'Export my data') }).click();
      expect((await download).suggestedFilename()).toBe('ta3lom-store-export.json');
    });

    test('Delete account: typed confirmation, then signed out (RUL-61)', async ({ page }) => {
      await customerWith(page, [], '/account/profile');
      await page
        .getByRole('button', { name: t('حذف حسابي', 'Delete my account'), exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const confirm = dialog.getByRole('button', {
        name: t('احذف حسابي نهائيًا', 'Delete my account for good'),
      });
      await expect(confirm).toBeDisabled();
      await expectNoA11yViolations(page, `/${locale}/account/profile delete dialog`);
      await dialog.locator('#del-word').fill(t('حذف', 'DELETE'));
      await confirm.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
      await expect(page.locator('.toast')).toContainText(
        t('حُذف حسابك', 'Your account was deleted'),
      );
      await page.goto(`/${locale}/account/courses`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login`));
    });

    test('Sign out on all devices from the profile (#20)', async ({ page, browser }) => {
      const { mobile } = await customerWith(page, [], '/account/profile');
      const other = await browser.newPage();
      await signIn(other, locale, mobile, '/account/courses');
      await page
        .getByRole('button', { name: t('الخروج من كل الأجهزة', 'Sign out everywhere') })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
      await other.goto(`/${locale}/account/courses`);
      await expect(other).toHaveURL(new RegExp(`/${locale}/login`));
      await other.close();
    });
  });
}
