#!/usr/bin/env node
/**
 * axe-core over the built output: every prerendered route (routes.txt) + the stateless client routes
 * (scripts/a11y-client-routes.txt), both locales, one theme per run (`A11Y_THEME=dark` — `npm run a11y` runs both).
 * Pages are served under the production CSP and given time to hydrate. Serious/critical violations fail the run;
 * moderate/minor are reported. Stateful screens are covered by the e2e specs (e2e/support/a11y.ts).
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalCsp } from './lib/csp.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const PORT = Number(process.env.A11Y_PORT ?? 4310);
const THEME = process.env.A11Y_THEME === 'dark' ? 'dark' : 'light';
const list = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);

if (!existsSync(BROWSER_DIR) || !existsSync('routes.txt')) {
  console.error('a11y: build first (`npm run build`).');
  process.exit(1);
}
// Arabic first (RTL first), then English.
const routes = [...list('routes.txt'), ...list('scripts/a11y-client-routes.txt')].sort((a, b) => (a.startsWith('/ar') === b.startsWith('/ar') ? 0 : a.startsWith('/ar') ? -1 : 1));
console.log(`a11y: ${routes.length} routes, ${THEME} theme`);
const server = await startStaticServer(BROWSER_DIR, PORT, { csp: readLocalCsp() });
const browser = await chromium.launch();
const failures = [];
let minor = 0;
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript((theme) => {
    try {
      localStorage.setItem('ta-theme', theme);
    } catch {
      /* the pre-paint script follows the OS */
    }
  }, THEME);
  for (const route of routes) {
    const page = await context.newPage();
    const res = await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() >= 400) {
      failures.push({ route, rule: 'http-status', impact: 'critical', help: `status ${res?.status()}`, nodes: [] });
      await page.close();
      continue;
    }
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of results.violations) {
      const entry = { route, rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) };
      if (v.impact === 'serious' || v.impact === 'critical') failures.push(entry);
      else {
        minor += 1;
        console.log(`  ⚠ [${v.impact}] ${route} — ${v.id}: ${v.help}`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  for (const f of failures) {
    console.error(`  ✗ [${f.impact}] ${f.route} — ${f.rule}: ${f.help}`);
    for (const n of f.nodes.slice(0, 5)) console.error(`      ${n}`);
  }
  console.error(`a11y: FAILED (${THEME}) — ${failures.length} serious/critical violation(s)`);
  process.exit(1);
}
console.log(`a11y: PASSED (${THEME}) — 0 serious/critical across ${routes.length} routes (${minor} moderate/minor)`);
