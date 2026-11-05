import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Showcase mode screenshots (SW-7): home + a project page, ar/en × 1440/375 (light) → docs/screenshots/showcase/.
 * `npm run build:ci-showcase` with the stub on :3000, then `npm run screenshots:showcase`. JPEG quality 55.
 */
const OUT = join(process.cwd(), 'docs', 'screenshots', 'showcase');
const API = (process.env['STORE_API_URL'] ?? 'http://localhost:3000/v1').replace(/\/$/, '');

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function shot(page: Page, file: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, file), fullPage: true, type: 'jpeg', quality: 55 });
}

for (const locale of ['ar', 'en'] as const)
  test(`showcase ${locale}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { slugs } = (await (await fetch(`${API}/catalog/projects?fields=slug`)).json()) as { slugs: string[] };
    let slug = slugs[0];
    for (const s of slugs) {
      const d = (await (await fetch(`${API}/catalog/projects/${s}`)).json()) as { options: unknown[] };
      if (d.options.length > 1) {
        slug = s;
        break;
      }
    }
    for (const w of [1440, 375] as const) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 900 },
        colorScheme: 'light',
        reducedMotion: 'reduce',
        locale: locale === 'ar' ? 'ar-SA' : 'en-GB',
      });
      const page = await ctx.newPage();
      await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
      await shot(page, `${locale}-${w}-1-home.jpg`);
      await page.goto(`/${locale}/p/${slug}`, { waitUntil: 'networkidle' });
      await shot(page, `${locale}-${w}-2-project.jpg`);
      await ctx.close();
    }
  });
