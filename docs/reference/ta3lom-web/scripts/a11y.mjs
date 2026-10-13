#!/usr/bin/env node
/**
 * axe-core over the built output, in BOTH locales — CLAUDE.md's `npm run a11y` and
 * docs/architecture/08-testing-and-budgets.md's "every prerendered route in the built output".
 *
 * Reads `routes.txt` (already /ar/ and /en/ prefixed — see scripts/routes.mjs) rather than
 * re-deriving a route list, so the a11y sweep, sitemap.xml and the prerendered set are
 * PROVABLY the same list: all three come from the one `allRoutes` array routes.mjs computes in
 * its `main()`. Do not hand-maintain a separate route list here.
 *
 * ⚠️ Serves `dist/ta3lom/browser` as the web root, NOT the `ar` subfolder — prerendered pages
 * reference `/ar/main.js` absolutely, so serving a locale folder as root 404s every script and
 * the page never hydrates (harmless for a static-HTML axe pass, but it would be wrong for
 * anything that needs the app to have booted).
 *
 * Serious/critical violations fail the run (exit 1). Moderate/minor are reported only.
 *
 * CR-01 FE-1: `A11Y_THEME=dark` (or `light`) pins the theme through the same localStorage key the
 * site's pre-paint script reads, so the colour-contrast rule runs against the dark palette too —
 * the gate runs both. The page is served under the production CSP (scripts/lib/csp.mjs).
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalCsp } from './lib/csp.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'ta3lom', 'browser');
const PORT = Number(process.env.A11Y_PORT ?? 4310);
const THEME = process.env.A11Y_THEME === 'dark' ? 'dark' : 'light';

function readRoutes() {
  if (!existsSync('routes.txt')) {
    throw new Error('routes.txt not found — run `node scripts/routes.mjs` (or `npm run build`) first.');
  }
  return readFileSync('routes.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
}

async function main() {
  if (!existsSync(BROWSER_DIR)) {
    console.error(`a11y: ${BROWSER_DIR} not found — run \`npm run build\` first.`);
    process.exit(1);
  }
  const routes = readRoutes();
  console.log(`a11y: checking ${routes.length} routes (both locales, ${THEME} theme) against http://localhost:${PORT}`);

  const server = await startStaticServer(BROWSER_DIR, PORT, { csp: readLocalCsp() });
  const browser = await chromium.launch();
  let seriousOrCritical = 0;
  let moderateOrMinor = 0;
  const failures = [];

  try {
    // Reduced motion: measure every page in its final state. Without it axe could catch a scroll
    // reveal mid-fade (taReveal starts at opacity 0 and has a 1200ms failsafe, longer than the wait
    // below) and report white text on a half-transparent box as low contrast: the flaky
    // color-contrast failure on the org chart in /about/leadership. Every animation honours this
    // setting (non-negotiable #8), so nothing is hidden from the check.
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem('ta-theme', theme);
      } catch {
        /* the pre-paint script then follows the OS, which is light here */
      }
    }, THEME);
    for (const route of routes) {
      const page = await context.newPage();
      const response = await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'load' });
      if (!response || response.status() >= 400) {
        failures.push({ route, rule: 'http-status', impact: 'critical', help: `Route did not load (status ${response?.status() ?? 'no response'})`, nodes: [] });
        seriousOrCritical += 1;
        await page.close();
        continue;
      }
      // Let CSS transitions settle before axe reads colours. `.btn` carries
      // `transition: all var(--dur-1)` (0.2s) and the reveal directive animates opacity over
      // --dur-3 (0.55s); axe's colour-contrast rule calls getComputedStyle, which mid-transition
      // returns an INTERPOLATED background. That produced an intermittent "serious" contrast
      // failure on a primary button whose resting contrast is 4.86:1 — a real pass reported as a
      // failure roughly one run in two. Waiting past the longest transition makes the gate
      // deterministic; it costs well under a second per route.
      await page.waitForTimeout(700);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
      for (const violation of results.violations) {
        const entry = { route, rule: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.map((n) => n.target.join(' ')) };
        if (violation.impact === 'serious' || violation.impact === 'critical') {
          seriousOrCritical += 1;
          failures.push(entry);
        } else {
          moderateOrMinor += 1;
          console.log(`  ⚠️  [${violation.impact}] ${route} — ${violation.id}: ${violation.help}`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('');
  if (failures.length) {
    console.error(`a11y: ${seriousOrCritical} serious/critical violation(s) across ${routes.length} routes:\n`);
    for (const f of failures) {
      console.error(`  ❌ [${f.impact}] ${f.route} — ${f.rule}: ${f.help}`);
      for (const node of f.nodes) console.error(`       ${node}`);
    }
    console.error(`\na11y: FAILED. ${moderateOrMinor} moderate/minor violation(s) also reported above (non-blocking).`);
    process.exit(1);
  }

  console.log(`a11y: PASSED (${THEME}) — 0 serious/critical violations across ${routes.length} routes (${moderateOrMinor} moderate/minor reported above).`);
}

await main();
