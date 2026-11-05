import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { apiGet, resetStub } from './support/api';

/**
 * SW-7 — showcase mode on the stub (`npm run build:ci-showcase`, CI step "@showcase"): what donors see, ar/en, with axe
 * in light and dark. Skipped on a live build (`E2E_SHOWCASE` unset), as the live specs are not run on this one.
 */
test.skip(!process.env['E2E_SHOWCASE'], 'needs a showcase build: npm run build:ci-showcase, E2E_SHOWCASE=1');
test.beforeEach(resetStub);

const NOTE = { ar: 'التبرع الإلكتروني قريبًا', en: 'Online donations open soon' } as const;
const PAGES = ['ta-cart-page', 'ta-checkout-page', 'ta-order-page', 'ta-login-page', 'ta-account-shell'];

interface Detail {
  slug: string;
  allowOpenAmount: boolean;
  options: { labelAr: string; labelEn: string | null }[];
}

async function projectWithOptions(): Promise<Detail> {
  const { slugs } = await apiGet<{ slugs: string[] }>('/catalog/projects?fields=slug');
  for (const s of slugs) {
    const d = await apiGet<Detail>(`/catalog/projects/${s}`);
    if (d.options.length > 1) return d;
  }
  throw new Error('no project with options in the stub');
}

for (const locale of ['ar', 'en'] as const) {
  test.describe(`@showcase /${locale}`, () => {
    test('home: the «soon» banner under the hero, read-only cards, no cart/sign-in/quick-donate entry', async ({
      page,
    }) => {
      const html = await (await page.request.get(`/${locale}/`)).text();
      expect(html).toContain(NOTE[locale]); // prerendered
      await page.goto(`/${locale}/`);
      await expect(page.locator('ta-showcase-note.sc-banner')).toContainText(NOTE[locale]);
      await expect(page.locator('ta-donate-box').first()).toContainText(NOTE[locale]);
      await expect(page.locator('ta-donate-box button, ta-donate-box input')).toHaveCount(0);
      await expect(page.locator('a.cartbtn, a.signin, button.quick, .side-quick, .qcard')).toHaveCount(0);
      await expect(page.locator('footer a[href$="/cart"], footer a[href$="/account/donations"]')).toHaveCount(0);
      await expectNoA11yViolations(page, `showcase /${locale}/`);
    });

    test('project page: options read only, the note, no sticky bar, no DonateAction in the JSON-LD', async ({
      page,
    }) => {
      const p = await projectWithOptions();
      await page.goto(`/${locale}/p/${p.slug}`);
      await expect(page.locator('h1')).toHaveCount(1);
      const box = page.locator('.buybox');
      await expect(box).toContainText(locale === 'en' && p.options[0].labelEn ? p.options[0].labelEn : p.options[0].labelAr);
      await expect(box.locator('[role=note]')).toContainText(NOTE[locale]);
      await expect(box.locator('button, input')).toHaveCount(0);
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ld.join('\n')).not.toContain('DonateAction');
      expect(ld.join('\n')).toContain('BreadcrumbList');
      await expectNoA11yViolations(page, `showcase /${locale}/p/${p.slug}`);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.mouse.wheel(0, 2000);
      await expect(page.locator('.dbar')).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });

    for (const path of ['cart', 'checkout', 'orders/T3-26-000001', 'login', 'account/donations']) {
      test(`/${path} goes to the home page without rendering its page`, async ({ page }) => {
        await page.addInitScript((selectors: string[]) => {
          const w = window as unknown as { __seen?: string[] };
          w.__seen = [];
          new MutationObserver(() => {
            for (const s of selectors) if (document.querySelector(s) && !w.__seen!.includes(s)) w.__seen!.push(s);
          }).observe(document, { childList: true, subtree: true });
        }, PAGES);
        await page.goto(`/${locale}/${path}`);
        await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
        await expect(page.locator('ta-showcase-note.sc-banner')).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)).toEqual([]);
      });
    }

    test('the staff admin is unchanged (its sign-in page renders)', async ({ page }) => {
      await page.goto(`/${locale}/admin/login`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/admin/login`));
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}

test('@showcase the sitemap lists no donor-only route', async ({ page }) => {
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>');
  expect(sitemap).not.toMatch(/\/(ar|en)\/(cart|checkout|orders|login|account)/);
});
