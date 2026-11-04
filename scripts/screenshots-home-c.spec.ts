import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Option C home screenshots (docs/r5/home-option-c-spec.md): ar/en × light/dark × 1440/768/360 → docs/screens/home-c/.
 * `npm run screenshots:home-c` (built output on :4320; stub or real API). JPEG quality 55 keeps the folder ≈ 3 MB; the
 * full set (PNG) is a CI artifact when needed.
 */
const OUT = join(process.cwd(), 'docs', 'screens', 'home-c');
const WIDTHS = [1440, 768, 360] as const;

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

async function shot(page: Page, file: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, file), fullPage: true, type: 'jpeg', quality: 55 });
}

for (const locale of ['ar', 'en'] as const)
  for (const theme of ['light', 'dark'] as const)
    test(`home C ${locale} ${theme}`, async ({ browser }) => {
      test.setTimeout(120_000);
      for (const w of WIDTHS) {
        const ctx = await browser.newContext({
          viewport: { width: w, height: 900 },
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: locale === 'ar' ? 'ar-SA' : 'en-GB',
        });
        const page = await ctx.newPage();
        await page.goto(`/${locale}/`, { waitUntil: 'networkidle' });
        await shot(page, `home-${locale}-${theme}-${w}.jpg`);
        await ctx.close();
      }
    });
