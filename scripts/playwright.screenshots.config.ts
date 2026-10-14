import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

/** `npm run screenshots` — the C.2 comparison set (scripts/screenshots.spec.ts), not part of the e2e suite. */
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  reporter: 'line',
  // The web server command is relative to the repo root (this config lives in scripts/).
  webServer: { ...(base.webServer as object), cwd: process.cwd() } as typeof base.webServer,
});
