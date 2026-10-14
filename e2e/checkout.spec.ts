import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { moveStock, printAvailable, setFormatPrice } from './support/admin-data';
import { freshMobile, otpFor, resetOtpLimits } from './support/auth';

/**
 * W-06 — checkout (#40, #41) and the thanks page (#42, dev confirm-payment) on the real API (plan §6 journeys). The
 * "expired order" journey mocks the status call, as the plan allows.
 */
for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  async function addToCart(
    page: Page,
    slug: string,
    opts: { digital?: boolean; plus?: number } = {},
  ) {
    await page.goto(`/${locale}/p/${slug}`);
    if (opts.digital) await page.locator('ta-buy-box label.opt').filter({ hasText: 'PDF' }).click();
    for (let i = 0; i < (opts.plus ?? 0); i++)
      await page.getByRole('button', { name: t('زيادة الكمية', 'Increase quantity') }).click();
    const before = Number(
      (await page
        .locator('a.cartbtn .n')
        .textContent({ timeout: 500 })
        .catch(() => '0')) || '0',
    );
    await page.locator('ta-buy-box .acts .b.primary').click();
    await expect(page.locator('a.cartbtn .n')).toHaveText(String(before + 1));
  }

  /** The inline OTP on /checkout (RUL-25). */
  async function verifyInline(page: Page, mobile: string) {
    resetOtpLimits();
    const started = Date.now() - 50;
    await page.locator('#otp-mobile').fill(mobile);
    await page.locator('#otp-mobile').press('Enter');
    await expect(page.locator('#otp-code')).toBeFocused();
    await page.locator('#otp-code').fill(await otpFor(mobile, started));
    await expect(page.locator('form.co')).toBeVisible();
  }

  async function fillDetails(page: Page) {
    await page.locator('#co-name').fill(t('نورة العتيبي', 'Noura Alotaibi'));
    await page.locator('#co-email').fill('noura@example.com');
  }

  async function payAndSettle(page: Page) {
    await page.locator('#co-terms').check();
    await page.locator('.pay-btn').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/orders/T3-[^/]+/thanks\\?t=`));
    await expect(page.locator('h1')).toHaveText(t('بانتظار الدفع', 'Awaiting payment'));
    await expect(page.locator('a.cartbtn .n')).toHaveCount(0);
    await expectNoA11yViolations(page, `/${locale}/orders/…/thanks pending`);
    await page
      .getByRole('button', { name: t('محاكاة الدفع (تطوير)', 'Simulate payment (dev)') })
      .click();
    await expect(page.locator('h1')).toContainText(t('شكرًا لك', 'Thank you'));
    await expect(
      page.locator('[role=status]').filter({ hasText: t('شكرًا لك', 'Thank you') }),
    ).toHaveCount(1);
  }

  test.describe(`checkout /${locale}`, () => {
    test('buy a course: cart → checkout → OTP → place order → awaiting payment → simulate → paid', async ({
      page,
    }) => {
      await addToCart(page, 'python-kids');
      await page.goto(`/${locale}/cart`);
      await page.locator('a.cta').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expectNoA11yViolations(page, `/${locale}/checkout identity`);

      await verifyInline(page, freshMobile());
      await expect(page.locator('#co-ship-h')).toHaveCount(0); // no print line → no shipping (RUL-26)
      await fillDetails(page);
      await page.locator('.pay-btn').click(); // terms not ticked
      await expect(page.locator('#co-terms-err')).toContainText(
        t('يلزم قبول الشروط', 'accept the terms'),
      );
      await expect(page.locator('#co-terms')).toBeFocused();
      await expectNoA11yViolations(page, `/${locale}/checkout details`);
      await page.setViewportSize({ width: 320, height: 800 });
      await expectNoHorizontalScroll(page);
      await page.setViewportSize({ width: 1280, height: 800 });

      await payAndSettle(page);
      await expect(page.locator('.receipt .ln').first()).toContainText(t('بايثون', 'Python'));
      await expect(
        page.locator('.receipt a', { hasText: t('ابدأ الدورة', 'Start the course') }),
      ).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/orders/…/thanks paid`);
    });

    test('buy books: print ×2 + digital → National Address validation → shipping 25 → paid', async ({
      page,
    }) => {
      await addToCart(page, 'letters-tales', { plus: 1 });
      await addToCart(page, 'science-stars-book', { digital: true });
      await page.goto(`/${locale}/checkout`);
      await verifyInline(page, freshMobile());
      await expect(page.locator('#co-ship-h')).toBeVisible();
      await expect(page.locator('.sumbox .r').nth(1)).toContainText('25');
      await expect(page.locator('.sumbox .r.t')).toContainText('170'); // 2 × 55 + 35 + 25
      await fillDetails(page);
      await page.locator('#co-rname').fill(t('نورة العتيبي', 'Noura Alotaibi'));
      await page.locator('#co-rmobile').fill('٠٥٥١٢٣٤٥٦٧'); // Arabic-Indic digits are accepted
      await page.locator('#co-city').fill(t('الرياض', 'Riyadh'));
      await page.locator('#co-short').fill('RRR2929');
      await page.locator('#co-terms').check();
      await page.locator('.pay-btn').click();
      await expect(page.locator('#co-short-err')).toContainText('RRRD2929');
      await expect(page.locator('#co-short')).toBeFocused();
      await page.locator('#co-short').fill('rrrd2929');
      await expect(page.locator('#co-short')).toHaveValue('RRRD2929');
      await expect(page.locator('#co-short-err li')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/checkout shipping`);
      await payAndSettle(page);
      await expect(page.locator('.receipt .ln.tot')).toContainText('170');
    });

    test('guest cart merge: an owned course is dropped with a notice (RUL-17)', async ({
      page,
      context,
    }) => {
      const mobile = freshMobile();
      await addToCart(page, 'early-childhood');
      await page.goto(`/${locale}/checkout`);
      await verifyInline(page, mobile);
      await fillDetails(page);
      await payAndSettle(page);

      await context.clearCookies(); // a new guest visit
      await page.goto(`/${locale}/`);
      await addToCart(page, 'early-childhood');
      await addToCart(page, 'letters-tales', { digital: true });
      await page.goto(`/${locale}/checkout`);
      await verifyInline(page, mobile);
      await expect(page.locator('.banner.info')).toContainText(
        t('مسجّل فيها مسبقًا', 'already enrolled'),
      );
      await expect(page.locator('.sumlines li')).toHaveCount(1);
    });

    test('price changed between quote and order: new total, pay again with a new Idempotency-Key (RUL-15)', async ({
      page,
    }) => {
      await addToCart(page, 'formative-guide', { digital: true });
      await page.goto(`/${locale}/checkout`);
      await verifyInline(page, freshMobile());
      await fillDetails(page);
      await page.locator('#co-terms').check();
      await expect(page.locator('.sumbox .r.t')).toContainText('45');
      const keys: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/v1/checkout'))
          keys.push(r.headers()['idempotency-key'] ?? '');
      });
      const before = await setFormatPrice('formative-guide', 'digital', '49.00');
      try {
        await page.locator('.pay-btn').click();
        await expect(page.locator('.banner.warn')).toBeFocused();
        await expect(page.locator('.sumbox .r.t')).toContainText('49');
        await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));
        await page.locator('.pay-btn').click();
        await expect(page).toHaveURL(/\/thanks\?t=/);
        expect(keys).toHaveLength(2);
        expect(keys[0]).not.toBe(keys[1]);
      } finally {
        await setFormatPrice('formative-guide', 'digital', before);
      }
    });

    test('out of stock: the last copy sold elsewhere → the line is reported invalid, nothing charged (RUL-24/30)', async ({
      page,
    }) => {
      await addToCart(page, 'formative-guide');
      await page.goto(`/${locale}/checkout`);
      await verifyInline(page, freshMobile());
      await fillDetails(page);
      await page.locator('#co-rname').fill('Noura');
      await page.locator('#co-rmobile').fill('0551234567');
      await page.locator('#co-city').fill('Riyadh');
      await page.locator('#co-short').fill('RRRD2929');
      await page.locator('#co-terms').check();
      const available = await printAvailable('formative-guide');
      await moveStock('formative-guide', -available);
      try {
        await page.locator('.pay-btn').click();
        await expect(page.locator('.banner.err')).toBeFocused();
        await expect(page.locator('.banner.err li')).toHaveCount(1);
        await expect(page.locator('.banner.err a')).toHaveAttribute('href', `/${locale}/cart`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));
      } finally {
        await moveStock('formative-guide', available);
      }
    });

    test('expired order (mock status): items back in the cart (RUL-29)', async ({ page }) => {
      await page.route('**/v1/orders/T3-26-999999/status?t=st_mock', (route) =>
        route.fulfill({
          json: {
            reference: 'T3-26-999999',
            status: 'expired',
            grandTotal: '120.00',
            paidAt: null,
            paymentDueAt: '2026-10-13T10:00:00Z',
            payment: null,
            canRetry: false,
            cartRestored: true,
            summary: {
              purchases: [{ titleAr: 'دورة', titleEn: 'A course', next: 'open_course' }],
              gifts: [],
              dedications: null,
              documents: null,
            },
          },
        }),
      );
      await page.goto(`/${locale}/orders/T3-26-999999/thanks?t=st_mock&status=paid`); // a gateway's `status` is ignored (RUL-33)
      await expect(page.locator('h1')).toHaveText(
        t('انتهت مهلة هذا الطلب', 'This order has expired'),
      );
      await expect(page.locator('.success')).toContainText(
        t('أعدنا العناصر إلى سلتك', 'Your items are back in your cart'),
      );
      await expect(page.locator('.success .acts a')).toHaveAttribute('href', `/${locale}/cart`);
      await expect(page.locator('.dev')).toHaveCount(0);
      await expectNoA11yViolations(page, `/${locale}/orders/…/thanks expired`);
    });

    test('thanks without a session or a token sends the visitor to sign in', async ({ page }) => {
      await page.goto(`/${locale}/orders/T3-26-000001/thanks`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?returnUrl=`));
    });

    test('an empty cart cannot reach checkout', async ({ page }) => {
      await page.goto(`/${locale}/checkout`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/cart$`));
    });
  });
}
