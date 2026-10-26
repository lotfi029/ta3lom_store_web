import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { apiGet, resetStub } from './support/api';

interface Card {
  slug: string;
  titleAr: string;
  titleEn: string | null;
  categorySlug: string;
  fromAmount: string | null;
}
interface Page {
  items: Card[];
  total: number;
}

test.beforeEach(resetStub);

/** W-M1 — home + listing + project card (D-W3, D-W5, C-4, U-2). Arabic first. */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke listing /${locale}`, () => {
    test('cards come in the API order with chips from the API; category filter, search and SEO', async ({
      page,
    }) => {
      const api = await apiGet<Page>('/catalog/projects?page=1&pageSize=12');
      const cats =
        await apiGet<{ slug: string; nameAr: string; nameEn: string | null }[]>(
          '/catalog/categories',
        );
      // F-1: cards carry their options (API-9) — no detail request per card.
      const detailRequests: string[] = [];
      page.on('request', (r) => {
        if (/\/catalog\/projects\/[^?]/.test(r.url())) detailRequests.push(r.url());
      });
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await expect(page.locator('h1')).toHaveCount(1);
      const titles = page.locator('ta-project-card h3');
      await expect(titles).toHaveCount(api.items.length);
      const name = (c: Card) => (locale === 'en' && c.titleEn ? c.titleEn : c.titleAr);
      await expect(titles).toHaveText(api.items.map(name));
      await expect(page.locator('nav.filters a')).toHaveCount(cats.length + 1);
      expect(detailRequests).toEqual([]);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.querySelector('script[type="application/ld+json"]')?.textContent ?? '',
          ),
        )
        .toContain('"ItemList"');

      const cat = cats[0];
      await page.locator('nav.filters a').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`category=${cat.slug}`));
      const filtered = await apiGet<Page>(
        `/catalog/projects?page=1&pageSize=12&category=${cat.slug}`,
      );
      await expect(titles).toHaveCount(filtered.items.length);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        `https://store.ta3lom.sa/${locale}/`,
      );

      await page.locator('#home-q').fill(api.items[0].titleAr.split(' ')[0]);
      await page.locator('#home-q').press('Enter');
      await expect(page).toHaveURL(/q=/);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expectNoA11yViolations(page);
    });

    test('a card with options: chip → stepper → اضافة adds to the cart and bumps the badge', async ({
      page,
    }) => {
      const api = await apiGet<Page>('/catalog/projects?page=1&pageSize=12');
      const withOptions = api.items.find((c) => c.fromAmount !== null)!;
      await page.goto(`/${locale}/`);
      const card = page.locator('ta-project-card', {
        hasText: locale === 'en' && withOptions.titleEn ? withOptions.titleEn : withOptions.titleAr,
      });
      await card.locator('.chip').first().click();
      await card.getByRole('button', { name: /^(إنقاص|Decrease)/ }).waitFor();
      await card.getByRole('button', { name: /^(زيادة|Increase)/ }).click();
      await card.locator('button.add').click();
      await expect(page.locator('ta-toast')).toContainText(locale === 'ar' ? 'السلة' : 'cart');
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
    });

    test('an amount-only card validates the amount against the config minimum (Arabic digits accepted)', async ({
      page,
    }) => {
      const api = await apiGet<Page>('/catalog/projects?page=1&pageSize=12');
      const amountOnly = api.items.find((c) => c.fromAmount === null)!;
      const config = await apiGet<{ minGiftAmount: string }>('/catalog/config');
      // Prerendered: typing before hydration finishes can be lost; hydration ends with the config refresh.
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const card = page.locator('ta-project-card', {
        hasText: locale === 'en' && amountOnly.titleEn ? amountOnly.titleEn : amountOnly.titleAr,
      });
      const field = card.locator('input[inputmode=decimal]');
      await field.fill('٥');
      await field.blur();
      await expect(field).toHaveValue('5');
      await expect(card.locator('.err').first()).toContainText(
        config.minGiftAmount.replace(/\.00$/, ''),
      );
      await field.fill('٧٥');
      await card.locator('button.add').click();
      await expect(page.locator('a.cartbtn .n')).toHaveText('1');
      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoHorizontalScroll(page);
    });
  });
}
