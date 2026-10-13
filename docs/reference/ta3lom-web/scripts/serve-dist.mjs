#!/usr/bin/env node
/**
 * Serves the built site for Playwright's e2e run (see playwright.config.ts's `webServer`).
 * Same static server a11y.mjs uses, so both consumers of `dist/ta3lom/browser` behave
 * identically. See scripts/lib/static-server.mjs for the "serve the root, not a locale
 * subfolder" note.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalCsp } from './lib/csp.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'ta3lom', 'browser');
const PORT = Number(process.env.E2E_PORT ?? 4320);

if (!existsSync(BROWSER_DIR)) {
  console.error(`serve-dist: ${BROWSER_DIR} not found — run \`npm run build\` first.`);
  process.exit(1);
}

// The production policy from deploy/.htaccess, API origin pointed at the stub (e2e/csp.spec.ts),
// and the .htaccess admin rewrite so e2e can open client-rendered admin screens.
await startStaticServer(BROWSER_DIR, PORT, { adminFallback: true, csp: readLocalCsp() });
console.log(`serve-dist: listening on http://localhost:${PORT}`);
