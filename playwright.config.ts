import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4320);

/**
 * e2e runs against the BUILT output (`npm run build` first), served by scripts/serve-dist.mjs under the production CSP,
 * talking to the REAL local store API (`npm run api:up && npm run api:seed`; plan §4). `page.route()` mocks only for
 * states the API can't produce on demand. Specs walk /ar first, then /en. `@smoke` specs also run in CI on the stub.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    locale: 'ar-SA',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
