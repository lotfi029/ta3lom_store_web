#!/usr/bin/env node
/** Serves the built site for Playwright (playwright.config.ts webServer), under the production CSP (API → localhost). */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalCsp } from './lib/csp.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const PORT = Number(process.env.E2E_PORT ?? 4320);
if (!existsSync(BROWSER_DIR)) {
  console.error('serve-dist: dist/store-web/browser not found — run `npm run build` first.');
  process.exit(1);
}
await startStaticServer(BROWSER_DIR, PORT, { csp: readLocalCsp() });
console.log(`serve-dist: listening on http://localhost:${PORT}`);
