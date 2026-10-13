import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4320);

/**
 * Runs against the BUILT output (`npm run build` must run first — CI does this before `e2e`,
 * see .github/workflows/ci.yml), served by scripts/serve-dist.mjs. `scripts/serve-dist.mjs`
 * serves both `/ar/…` and `/en/…` from the one static root, so a single project is enough —
 * specs hit both locale paths explicitly by URL (see e2e/prerender.spec.ts).
 *
 * docs/architecture/08-testing-and-budgets.md asks for "a dir='rtl' project and a dir='ltr'
 * project, same specs" once real navigation-flow specs exist (Part 3+ of the admin build) — that
 * is a per-locale fixture that parametrizes a route prefix, not a browser-context `dir` setting
 * (Playwright has none; direction comes from the served HTML's own `dir` attribute). Add it when
 * there is a flow spec to run twice, rather than two identical projects now.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
