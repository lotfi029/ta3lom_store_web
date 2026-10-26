import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { apiGet, resetStub } from './support/api';

interface Detail {
  slug: string;
  titleAr: string;
  titleEn: string | null;
  allowOpenAmount: boolean;
  options: { id: string; labelAr: string; amount: string }[];
}

test.beforeEach(resetStub);

/** W-M2 — project page: prerendered, story, donate box, share, JSON-LD, 404 (E-1). */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke project /${locale}`, () => {
    test('prerendered page with the story, options, JSON-LD; option × 2 → cart', async ({
      page,
    }) => {
      const { slugs } = await apiGet<{ slugs: string[] }>('/catalog/projects?fields=slug');
      let p: Detail | null = null;
      for (const s of slugs) {
        const d = await apiGet<Detail>(`/catalog/projects/${s}`);
        if (d.options.length > 1 && d.allowOpenAmount) {
          p = d;
          break;
        }
      }
      expect(p).not.toBeNull();
      const res = await page.request.get(`/${locale}/p/${p!.slug}`);
      // Prerendered: the title and the options are in the HTML before any script runs.
      const html = await res.text();
      expect(html).toContain(locale === 'en' && p!.titleEn ? p!.titleEn : p!.titleAr);
      expect(html).toContain('type="radio"');
      await page.goto(`/${locale}/p/${p!.slug}`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(
        locale === 'en' && p!.titleEn ? p!.titleEn : p!.titleAr,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
          ),
        )
        .toContain('DonateAction');
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        `https://store.ta3lom.sa/${locale}/p/${p!.slug}`,
      );

      const box = page.locator('aside.buybox');
      await box.locator('.chip').nth(1).click();
      await box.getByRole('button', { name: /^(زيادة|Increase)/ }).click();
      await box.locator('button.add').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');

      await box
        .locator('.chip', { hasText: locale === 'ar' ? 'تبرع مفتوح' : 'Open amount' })
        .click();
      await expect(box.locator('.preset').first()).toBeVisible();
      await expectNoA11yViolations(page);
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
    });

    test('an unknown slug shows "not available", noindex', async ({ page }) => {
      await page.goto(`/${locale}/p/no-such-project`);
      await expect(page.locator('.gone h1')).toBeVisible();
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expectNoA11yViolations(page);
    });
  });
}
