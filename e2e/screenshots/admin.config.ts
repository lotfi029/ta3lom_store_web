import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

/**
 * `npm run screenshots:admin` — admin redesign screenshots (docs/admin-redesign/03 §13), never part of `npm run e2e`
 * or CI. Same built output and real API as the e2e suite.
 */
export default defineConfig({
  ...base,
  testDir: '.',
  testIgnore: [],
  testMatch: /admin-redesign\.spec\.ts/,
  reporter: 'line',
  timeout: 600_000,
  webServer: { ...(base.webServer as object), cwd: process.cwd() } as typeof base.webServer,
});
