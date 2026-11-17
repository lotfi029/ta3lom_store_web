import { test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { staffSignIn } from '../support/auth';

/**
 * Admin redesign screenshots (docs/admin-redesign/03 §13, owner review M7). Not part of `npm run e2e`.
 *
 *   ADMIN_SHOTS_PHASE=w-a1 ADMIN_SHOTS=shell,projects npm run screenshots:admin
 *
 * Every screen × 1440/834/390 × ar-light / ar-dark / en-light → docs/screenshots/admin-redesign/<phase>/ (JPEG q80).
 * `storefront` captures `/ar/` and `/ar/p/<slug>` (ar light, 1440 + 390) into <phase>/storefront/ for the
 * before/after comparison; it needs no sign-in.
 */
const PHASE = process.env['ADMIN_SHOTS_PHASE'] ?? 'w-a0';
const WANTED = new Set(
  (process.env['ADMIN_SHOTS'] ?? 'storefront').split(',').map((s) => s.trim()),
);
const OUT = join(process.cwd(), 'docs', 'screenshots', 'admin-redesign', PHASE);
const API = (process.env['STORE_API_URL'] ?? 'http://localhost:5080/v1').replace(/\/$/, '');

const WIDTHS = [1440, 834, 390] as const;
const VARIANTS = [
  { locale: 'ar', theme: 'light' },
  { locale: 'ar', theme: 'dark' },
  { locale: 'en', theme: 'light' },
] as const;

/** Screen name → admin path (without locale). Functions get the API so they can find a real id or reference. */
const SCREENS: Record<string, (api: string) => Promise<string>> = {
  shell: async () => '/admin',
  menu: async () => '/admin/menu',
  dashboard: async () => '/admin',
  projects: async () => '/admin/projects',
  project: async () => `/admin/projects/${await firstProjectId()}`,
  orders: async () => '/admin/orders',
  media: async () => '/admin/media',
  categories: async () => '/admin/categories',
  donors: async () => '/admin/donors',
  settings: async () => '/admin/settings',
  'settings-store': async () => '/admin/settings/store',
  staff: async () => '/admin/staff',
  templates: async () => '/admin/templates',
  audit: async () => '/admin/audit',
  reports: async () => '/admin/reports',
  orphans: async () => '/admin/payments/orphans',
};

let projectId = '';
async function firstProjectId(): Promise<string> {
  if (projectId) return projectId;
  const { items } = (await (await fetch(`${API}/catalog/projects?pageSize=1`)).json()) as {
    items: { id: string }[];
  };
  projectId = items[0]?.id ?? 'new';
  return projectId;
}

async function shot(page: Page, file: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, file), fullPage: true, type: 'jpeg', quality: 80 });
}

async function setTheme(ctx: BrowserContext, theme: 'light' | 'dark') {
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('ta-theme', t);
    } catch {
      /* storage blocked */
    }
  }, theme);
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('storefront before/after', async ({ browser }) => {
  test.skip(!WANTED.has('storefront'), 'not requested');
  mkdirSync(join(OUT, 'storefront'), { recursive: true });
  const { slugs } = (await (await fetch(`${API}/catalog/projects?fields=slug`)).json()) as {
    slugs: string[];
  };
  const slug = [...slugs].sort()[0];
  for (const w of [1440, 390] as const) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      reducedMotion: 'reduce',
      locale: 'ar-SA',
    });
    await setTheme(ctx, 'light');
    const page = await ctx.newPage();
    await page.goto('/ar/', { waitUntil: 'networkidle' });
    await shot(page, `storefront/ar-${w}-home.jpg`);
    await page.goto(`/ar/p/${slug}`, { waitUntil: 'networkidle' });
    await shot(page, `storefront/ar-${w}-project.jpg`);
    await ctx.close();
  }
});

test('admin screens', async ({ browser }) => {
  const screens = Object.keys(SCREENS).filter((s) => WANTED.has(s));
  test.skip(screens.length === 0, 'no admin screen requested');
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
      locale: v.locale === 'ar' ? 'ar-SA' : 'en-GB',
    });
    await setTheme(ctx, v.theme);
    const page = await ctx.newPage();
    await staffSignIn(page, v.locale, 'admin');
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      for (const s of screens) {
        const path = await SCREENS[s]!(API);
        await page.goto(`/${v.locale}${path}`, { waitUntil: 'networkidle' });
        await page
          .locator('h1')
          .first()
          .waitFor({ timeout: 15_000 })
          .catch(() => undefined);
        await shot(page, `${s}-${w}-${v.locale}-${v.theme}.jpg`);
      }
    }
    await ctx.close();
  }
});
