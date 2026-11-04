import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { API, onStub } from './support/api';
import { freshMobile, otpFor, staffSignIn } from './support/auth';
import { placeOrder, type PlacedOrder } from './support/donate';
import { payOnHostedPage } from './support/payment';

/**
 * R5-Payments journeys (plan §6 F5c, ADR-S05) on the REAL API with its fake gateway (Development only, C-2): every
 * outcome is decided by a signed webhook through the real handler or by a job — never by the return URL. ar first, then
 * en. Not on the CI stub (it has no review, refunds, clock or jobs); the stub's @smoke donate journey covers pay → paid.
 */
const DEV = API.replace(/\/v1$/, '/dev');

async function dev(method: 'GET' | 'POST', path: string, body?: object): Promise<Response> {
  return fetch(`${DEV}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function status(o: PlacedOrder): Promise<Record<string, unknown>> {
  const r = await fetch(`${API}/orders/${o.reference}/status?t=${encodeURIComponent(o.statusToken)}`);
  expect(r.status).toBe(200);
  return (await r.json()) as Record<string, unknown>;
}

const orderUrl = (locale: string, o: PlacedOrder) =>
  `/${locale}/orders/${o.reference}?t=${encodeURIComponent(o.statusToken)}`;

async function toGateway(page: Page, o: PlacedOrder) {
  expect(o.redirectUrl).toMatch(/\/dev\/payments\//);
  await page.goto(o.redirectUrl!);
}

test.describe.configure({ mode: 'serial' });

for (const locale of ['ar', 'en'] as const) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  test.describe(`payments /${locale}`, () => {
    test.skip(onStub, 'needs the real API (fake gateway, jobs, clock)');

    test('pay → paid with a DR receipt (the return URL proves nothing: the page asks the API)', async ({ page }) => {
      const o = await placeOrder(freshMobile(), locale);
      await toGateway(page, o);
      await payOnHostedPage(page, 'pay');
      await expect(page.locator('.osec .card h2')).toContainText(t('وصل تبرعك', 'your donation arrived'));
      await expect(page.locator('.kv')).toContainText(/DR-\d{4}-\d{6}/);
      const download = page.waitForEvent('download');
      await page.locator('.receipt button').first().click();
      expect((await download).suggestedFilename()).toMatch(/^DR-\d{4}-\d{6}\.pdf$/);
      expect((await status(o))['status']).toBe('paid');
      await expectNoA11yViolations(page, `/${locale}/orders paid`);
    });

    test('fail → retry → paid', async ({ page }) => {
      const o = await placeOrder(freshMobile(), locale);
      await toGateway(page, o);
      await payOnHostedPage(page, 'fail');
      await expect(page.locator('.osec .card h2')).toContainText(t('لم يكتمل الدفع', 'didn’t go through'));
      await expectNoA11yViolations(page, `/${locale}/orders retry`);
      await page.locator('button.pay-again').click();
      await payOnHostedPage(page, 'pay');
      await expect(page.locator('.osec .card h2')).toContainText(t('وصل تبرعك', 'your donation arrived'));
      const s = await status(o);
      expect(s['status']).toBe('paid');
      expect(s['canRetryPayment']).toBe(false);
    });

    test('wrong amount → payment review → finance accepts → paid', async ({ page }) => {
      const o = await placeOrder(freshMobile(), locale);
      await toGateway(page, o);
      await payOnHostedPage(page, 'wrong');
      await expect(page.locator('.osec .card h2')).toContainText(t('نراجع دفعتك', 'reviewing your payment'));
      expect((await status(o))['status']).toBe('payment_review');

      await staffSignIn(page, locale, 'finance');
      await page.goto(`/${locale}/admin/orders/${o.reference}`);
      await expect(page.locator('.panel.pay')).toBeVisible();
      await expectNoA11yViolations(page, `/${locale}/admin/orders/:ref review`);
      await page.getByRole('button', { name: t('قبول الدفعة', 'Accept payment'), exact: true }).click();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toBeVisible();
      await dlg.getByRole('button', { name: t('تأكيد', 'Confirm') }).click();
      await expect(page.locator('ta-toast')).toContainText(t('قُبلت الدفعة', 'Payment accepted'));
      await expect(page.locator('ta-status-pill').first()).toContainText(t('مدفوع', 'Paid'));
      await expect(page.locator('.panel.pay')).toContainText(/DR-\d{4}-\d{6}/);
      expect((await status(o))['status']).toBe('paid');
    });

    test('partial refund, then the rest → refunded with a DRC cancellation receipt', async ({ page }) => {
      const o = await placeOrder(freshMobile(), locale, '50');
      await toGateway(page, o);
      await payOnHostedPage(page, 'pay');
      await expect(page.locator('.osec .card h2')).toContainText(t('وصل تبرعك', 'your donation arrived'));

      await staffSignIn(page, locale, 'finance');
      await page.goto(`/${locale}/admin/orders/${o.reference}`);
      const refund = async (amount: string) => {
        await page.getByRole('button', { name: t('استرداد', 'Refund'), exact: true }).click();
        const dlg = page.getByRole('dialog');
        await expect(dlg).toBeVisible();
        await dlg.locator('#ao-amount').fill(amount);
        await dlg.locator('#ao-reason').fill('e2e');
        const confirm = dlg.getByRole('button', { name: t('تأكيد', 'Confirm') });
        await expect(confirm).toBeDisabled(); // the reference is not typed back yet
        await dlg.locator('#ao-typed').fill(o.reference.toLowerCase());
        await expectNoA11yViolations(page, `/${locale}/admin refund dialog`);
        await confirm.click();
        await expect(page.locator('ta-toast').last()).toContainText(t('تم الاسترداد', 'Refunded'));
        await expect(dlg).toBeHidden();
      };
      // Over the refundable amount: the confirm button stays disabled.
      await page.getByRole('button', { name: t('استرداد', 'Refund'), exact: true }).click();
      await page.getByRole('dialog').locator('#ao-amount').fill('50.01');
      await page.getByRole('dialog').locator('#ao-reason').fill('e2e');
      await page.getByRole('dialog').locator('#ao-typed').fill(o.reference);
      await expect(page.getByRole('dialog').getByRole('button', { name: t('تأكيد', 'Confirm') })).toBeDisabled();
      await page.getByRole('dialog').getByRole('button', { name: t('رجوع', 'Back') }).click();

      await refund('20');
      expect((await status(o))['status']).toBe('paid');
      expect((await status(o))['refundedAmount']).toBe('20.00');
      await refund('30');
      await expect(page.locator('ta-status-pill').first()).toContainText(t('مسترد', 'Refunded'));
      await expect(page.locator('.panel.pay')).toContainText(/DRC-\d{4}-\d{6}/);

      await page.goto(orderUrl(locale, o));
      await expect(page.locator('.osec .card h2')).toContainText(t('تم استرداد تبرعك', 'was refunded'));
      const download = page.waitForEvent('download');
      await page.locator('.receipt button').nth(1).click();
      expect((await download).suggestedFilename()).toMatch(/^DRC-\d{4}-\d{6}\.pdf$/);
      await expectNoA11yViolations(page, `/${locale}/orders refunded`);
    });

    test('unpaid past the payment window → the expiry job closes it (dev clock)', async ({ page }) => {
      const o = await placeOrder(freshMobile(), locale);
      try {
        expect((await dev('POST', '/clock', { advanceMinutes: 24 * 60 + 1 })).status).toBe(200);
        expect((await dev('POST', '/jobs/ExpireUnpaidOrdersJob')).status).toBe(202);
        await expect.poll(async () => (await status(o))['status'], { timeout: 15_000 }).toBe('expired');
      } finally {
        await dev('POST', '/clock', { reset: true });
      }
      await page.goto(orderUrl(locale, o));
      await expect(page.locator('.osec .card h2')).toContainText(t('انتهت مهلة الدفع', 'payment time has passed'));
      await expect(page.locator('button.pay-again')).toHaveCount(0);
    });

    test('quick donate → checkout → hosted page → paid', async ({ page }) => {
      await page.goto(`/${locale}/`);
      await page.locator('header .acts > button.quick').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.locator('#qd-cat').selectOption({ index: 1 });
      await dialog.locator('.preset').first().click();
      await dialog.getByRole('button', { name: t('تبرع الآن', 'Donate now') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));

      const mobile = freshMobile();
      const started = Date.now() - 50;
      await page.locator('#otp-mobile').fill(mobile);
      await page.locator('#otp-mobile').press('Enter');
      await page.locator('#otp-code').fill(await otpFor(mobile, started));
      await page.locator('#co-name').fill('متبرع سريع');
      await page.locator('#co-email').fill(`quick-${Date.now()}@example.com`);
      await page.locator('button.pay-btn').click();
      await payOnHostedPage(page, 'pay');
      await expect(page.locator('.osec .card h2')).toContainText(t('وصل تبرعك', 'your donation arrived'));
    });
  });
}
