import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './support/a11y';
import { apiGet, resetStub } from './support/api';

interface Card {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  badge: string | null;
  categorySlug: string;
}
interface Paged {
  items: Card[];
  total: number;
}
interface Cat {
  slug: string;
  nameAr: string;
  nameEn: string | null;
  projectCount: number | string;
  acceptsGeneralGifts: boolean;
}

test.beforeEach(resetStub);

const pick = (ar: string, en: string | null, locale: 'ar' | 'en') =>
  locale === 'en' && en ? en : ar;
const titles = (page: Page) => page.locator('ta-project-card h3');
const titleOf = (c: Card, locale: 'ar' | 'en') => pick(c.titleAr, c.titleEn, locale);

/**
 * Option C home (docs/r5/home-option-c-spec.md §3–§5) on the seeded catalogue (28 projects, 10 categories, one empty):
 * tabs, paging and back/forward, search, sort, the banner, the inline quick donate, empty and unknown categories,
 * URL normalisation (M-5) and the focus/announce behaviour (M-6). Arabic first.
 */
for (const locale of ['ar', 'en'] as const) {
  test.describe(`@smoke home C /${locale}`, () => {
    test('tab → filtered grid → page 2 → back restores each state; focus on the results heading', async ({
      page,
    }) => {
      const all = await apiGet<Paged>('/catalog/projects?page=1&pageSize=20');
      const p2 = await apiGet<Paged>('/catalog/projects?page=2&pageSize=20');
      expect(all.total).toBeGreaterThan(20);
      const cats = await apiGet<Cat[]>('/catalog/categories');
      const cat = cats.find((c) => Number(c.projectCount) > 1)!;
      const inCat = await apiGet<Paged>(
        `/catalog/projects?page=1&pageSize=20&category=${cat.slug}`,
      );

      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('#list-h')).toContainText(String(all.total));
      await expect(titles(page)).toHaveCount(20);
      const tabs = page.locator('ta-category-tabs nav a');
      await expect(tabs).toHaveCount(cats.length + 1);
      await expect(tabs.first()).toHaveAttribute('aria-current', 'page');

      await tabs.filter({ hasText: pick(cat.nameAr, cat.nameEn, locale) }).click();
      await expect(page).toHaveURL(new RegExp(`category=${cat.slug}`));
      await expect(titles(page)).toHaveText(inCat.items.map((c) => titleOf(c, locale)));
      await expect(tabs.filter({ hasText: pick(cat.nameAr, cat.nameEn, locale) })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.locator('#list-h')).toBeFocused();

      await tabs.first().click();
      await expect(page).not.toHaveURL(/category=/);
      await page.locator('nav.pager a', { hasText: /^2$/ }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(titles(page)).toHaveText(p2.items.map((c) => titleOf(c, locale)));
      await expect(page.locator('nav.pager [aria-current=page]')).toHaveText('2');
      await expect(page.locator('#list-h')).toBeFocused();
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');

      await page.goBack();
      await expect(page).not.toHaveURL(/page=2/);
      await expect(titles(page)).toHaveText(all.items.map((c) => titleOf(c, locale)));
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`category=${cat.slug}`));
      await expect(titles(page)).toHaveText(inCat.items.map((c) => titleOf(c, locale)));
      await page.goForward();
      await page.goForward();
      await expect(page).toHaveURL(/page=2/);
    });

    test('search: results keep the query in the box; no results show q + clear', async ({
      page,
    }) => {
      const all = await apiGet<Paged>('/catalog/projects?page=1&pageSize=20');
      const target = all.items.find((c) => c.slug.startsWith('c-')) ?? all.items[0];
      const word = target.titleAr.split(' ')[0];
      const hits = await apiGet<Paged>(
        `/catalog/projects?page=1&pageSize=20&q=${encodeURIComponent(word)}`,
      );
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await page.locator('#hdr-q').fill(word);
      await page.locator('#hdr-q').press('Enter');
      await expect(page).toHaveURL(/\?q=/);
      await expect(titles(page)).toHaveCount(hits.items.length);
      await expect(page.locator('#hdr-q')).toHaveValue(word);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );

      await page.locator('#hdr-q').fill('zzqx-لا-يوجد');
      await page.locator('#hdr-q').press('Enter');
      const empty = page.locator('.empty');
      await expect(empty).toContainText('zzqx-لا-يوجد');
      await expectNoA11yViolations(page, `/${locale}/?q= (no results)`);
      await empty.locator('a.reset').click();
      await expect(page).not.toHaveURL(/q=/);
      await expect(titles(page)).toHaveCount(20);
    });

    test('sort: الاسم / Name follows the API order for sort=title; the select keeps focus (F-2)', async ({ page }) => {
      const byTitle = await apiGet<Paged>('/catalog/projects?page=1&pageSize=20&sort=title');
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await page.locator('#sort').focus(); // a keyboard user is on the select
      await page.locator('#sort').selectOption('title');
      await expect(page).toHaveURL(/sort=title/);
      await expect(titles(page)).toHaveText(byTitle.items.map((c) => titleOf(c, locale)));
      await expect(page.locator('#sort')).toBeFocused();
      await expect(page.locator('#list-h')).not.toBeFocused();
    });

    test('F-1: a page change never jumps to the top; Back restores the position without stealing focus', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const pager = page.locator('nav.pager');
      await pager.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(200);
      await page.evaluate(() => {
        const w = window as unknown as { minY: number };
        w.minY = window.scrollY;
        window.addEventListener('scroll', () => (w.minY = Math.min(w.minY, window.scrollY)));
      });
      await pager.locator('a', { hasText: /^2$/ }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator('#list-h')).toBeFocused();
      const minY = await page.evaluate(() => (window as unknown as { minY: number }).minY);
      expect(minY).toBeGreaterThan(0); // no jump to 0,0 on a query-only change
      const barTop = await page.evaluate(() => document.querySelector('#list-h')!.getBoundingClientRect().top);
      expect(barTop).toBeGreaterThanOrEqual(-2);
      expect(barTop).toBeLessThan(400);

      await page.goBack();
      await expect(page).not.toHaveURL(/page=2/);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 50);
      // focusResults is skipped on popstate: the restored position stays (it would scroll up to the filter bar)
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 50);
    });

    test('L-9: the header search searches everything — drops the category and the page, keeps the sort', async ({
      page,
    }) => {
      const cats = await apiGet<Cat[]>('/catalog/categories');
      const cat = cats.find((c) => Number(c.projectCount) > 1)!;
      await page.goto(`/${locale}/?category=${cat.slug}&sort=title`, { waitUntil: 'networkidle' });
      await page.locator('#hdr-q').fill('a');
      await page.locator('#hdr-q').press('Enter');
      await expect(page).toHaveURL(/[?&]q=a/);
      await expect(page).toHaveURL(/sort=title/);
      await expect(page).not.toHaveURL(/category=|page=/);
    });

    test('empty category and unknown category (noindex) both link back to all projects', async ({
      page,
    }) => {
      const cats = await apiGet<Cat[]>('/catalog/categories');
      const empty = cats.find((c) => Number(c.projectCount) === 0)!;
      await page.goto(`/${locale}/?category=${empty.slug}`, { waitUntil: 'networkidle' });
      await expect(page.locator('.empty h3')).toContainText(
        locale === 'ar' ? 'لا توجد مشاريع في هذا التصنيف' : 'no projects in this category',
      );
      await expect(page.locator('.empty a.reset')).toBeVisible();

      await page.goto(`/${locale}/?category=c-no-such-category`, { waitUntil: 'networkidle' });
      await expect(page.locator('.empty h3')).toContainText(
        locale === 'ar' ? 'هذا التصنيف غير متاح' : 'not available',
      );
      await expect(page.locator('meta[name=robots]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await page.locator('.empty a.reset').click();
      await expect(page).not.toHaveURL(/category=/);
    });

    test('M-5: bad parameters are normalised (replaceUrl); a page past the end → the last page', async ({
      page,
    }) => {
      const all = await apiGet<Paged>('/catalog/projects?page=1&pageSize=20');
      const last = Math.ceil(all.total / 20);
      await page.goto(`/${locale}/?sort=zakat&page=abc&category=X!`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
      await page.goto(`/${locale}/?page=99`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`page=${last}$`));
      await expect(page.locator('nav.pager [aria-current=page]')).toHaveText(String(last));
      // L-8: our own clamp neither scrolls nor moves focus
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator('#list-h')).not.toBeFocused();
    });

    test('banner: first urgent featured card is the h1; prev/next change it (no auto-rotate); CTA → /p/{slug}', async ({
      page,
    }) => {
      const home = await apiGet<{ featured: Card[] }>('/catalog/home');
      const urgent = home.featured.filter((c) => c.badge === 'urgent');
      const slides = urgent.length ? urgent : home.featured.slice(0, 1);
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const banner = page.locator('ta-home-banner');
      await expect(banner.locator('h1')).toHaveText(titleOf(slides[0], locale));
      if (slides.length > 1) {
        await expect(banner.locator('.dot')).toHaveCount(slides.length);
        await banner.locator('.next').click();
        await expect(banner.locator('h1')).toHaveText(titleOf(slides[1], locale));
        await expect(banner.locator('[aria-live=polite]')).toContainText(
          titleOf(slides[1], locale),
        );
        await banner.locator('.prev').click();
        await expect(banner.locator('h1')).toHaveText(titleOf(slides[0], locale));
      }
      await expectNoA11yViolations(page, `/${locale}/ banner`);
      await banner.locator('a.cta').click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/p/${slides[0].slug}$`));
    });

    test('inline quick donate: preset → تبرع الآن → checkout with the category gift', async ({
      page,
    }) => {
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const card = page.locator('aside.qcard');
      await expect(card.locator('h2')).toBeVisible();
      await card.locator('.preset').first().click();
      await card
        .getByRole('button', { name: locale === 'ar' ? 'تبرع الآن' : 'Donate now' })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/checkout$`));
      await expect(page.locator('a.cartbtn')).toHaveAttribute('data-lines', '1');
      await expect(page.locator('a.cartbtn .ctot')).toBeVisible();
    });

    test('keyboard: tab links, pagination and the banner controls are reachable; 320 px has no page scroll', async ({
      page,
    }) => {
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const tab = page.locator('ta-category-tabs nav a').nth(1);
      await tab.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/category=/);
      await expect(page.locator('#list-h')).toBeFocused();
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      const next = page.locator('nav.pager a.step');
      await next.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator('#list-h')).toBeFocused();
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page, `/${locale}/ 320 px`);
    });

    test('P5: API down at runtime → the prerendered grid stays, with a notice (no error page, no stack)', async ({
      page,
    }) => {
      const all = await apiGet<Paged>('/catalog/projects?page=1&pageSize=20');
      // Hydration replays the embedded data; the refresh after hydration then fails (and its one retry, M-7).
      await page.route(/\/v1\/catalog\//, (r) => r.abort('connectionrefused'));
      await page.goto(`/${locale}/`);
      await expect(page.locator('p.stale')).toBeVisible({ timeout: 15_000 });
      await expect(titles(page)).toHaveCount(all.items.length);
      await expect(page.locator('ta-home-banner h1')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/at \w+ \(|TypeError|HttpErrorResponse/);
      await expectNoA11yViolations(page, `/${locale}/ stale`);
      await page.unroute(/\/v1\/catalog\//);
      await page.locator('p.stale button.retry').click();
      await expect(page.locator('p.stale')).toHaveCount(0);
    });
  });
}
