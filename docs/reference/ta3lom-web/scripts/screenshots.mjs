#!/usr/bin/env node
/**
 * Dev-only visual check over the BUILT output (never part of the build or CI gate).
 *
 *   node scripts/screenshots.mjs --out <dir> [--routes /,/contact,admin:/admin/programs]
 *        [--locales ar,en] [--widths 320,1280] [--themes light,dark] [--tab 25]
 *
 * For every locale × route × theme × width it saves a full-page PNG, and it FAILS (exit 1) when a
 * page scrolls horizontally at any width — CLAUDE.md's "no horizontal scroll at 320 px". Arabic is
 * always walked first. `--tab N` also records a keyboard-only walk: N presses of Tab from the top
 * of the page, logging each focused element and whether it shows a visible focus indicator.
 *
 * Needs `npm run stub-api` for the admin routes and for the post-hydration reload. The theme is
 * chosen the same way a visitor would: `localStorage['ta-theme']`, set before the page loads.
 * Motion is emulated as reduced so scroll reveals don't photograph mid-animation.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readLocalCsp } from './lib/csp.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return pairs;
  }, []),
);
const list = (value, fallback) => (value ?? fallback).split(',').map((s) => s.trim()).filter(Boolean);

const OUT = args.out;
if (!OUT) {
  console.error('screenshots: --out <dir> is required');
  process.exit(2);
}
const ROUTES = list(args.routes, '/,/programs/nujoom-al-uloom,/contact,admin:/admin/programs');
const LOCALES = list(args.locales, 'ar,en').sort((a) => (a === 'ar' ? -1 : 1));
const WIDTHS = list(args.widths, '320,1280').map(Number);
const THEMES = list(args.themes, 'light,dark');
const TAB = Number(args.tab ?? 0);
const PORT = Number(args.port ?? 4330);
const BROWSER_DIR = join(process.cwd(), 'dist', 'ta3lom', 'browser');

if (!existsSync(BROWSER_DIR)) {
  console.error('screenshots: dist/ta3lom/browser not found — build first.');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const slug = (route) => route.replace(/^admin:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';

const server = await startStaticServer(BROWSER_DIR, PORT, { adminFallback: true, csp: readLocalCsp() });
const browser = await chromium.launch();
const problems = [];
const index = [];

async function login(page, locale) {
  await page.goto(`http://localhost:${PORT}/${locale}/admin/login`);
  await page.fill('#l-email', 'admin@ta3lom.sa');
  await page.fill('#l-password', 'password123');
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(/\/admin\/overview/, { timeout: 10000 });
}

try {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await context.addInitScript((value) => {
        try {
          localStorage.setItem('ta-theme', value);
        } catch {
          /* private mode — theme falls back to system */
        }
      }, theme);
      const page = await context.newPage();
      let loggedIn = false;
      for (const raw of ROUTES) {
        const isAdmin = raw.startsWith('admin:');
        const route = raw.replace(/^admin:/, '');
        if (isAdmin && !loggedIn) {
          await login(page, locale);
          loggedIn = true;
        }
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
                    if (isAdmin) {
            // Client-side navigation keeps the in-memory access token (it is never persisted).
            await page.evaluate((path) => {
              history.pushState({}, '', path);
              dispatchEvent(new PopStateEvent('popstate'));
            }, `/${locale}${route}`);
          } else {
            await page.goto(url(locale, route), { waitUntil: 'networkidle' });
          }
          await page.waitForTimeout(900);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 0) problems.push(`${locale} ${theme} ${width}px ${route}: horizontal scroll of ${overflow}px`);
          const file = `${locale}-${slug(raw)}-${theme}-${width}.png`;
          await page.screenshot({ path: join(OUT, file), fullPage: true });
          index.push(`| ${locale} | ${route} | ${theme} | ${width} | ${file} |`);
        }
        if (TAB > 0 && theme === THEMES[0]) {
          await page.setViewportSize({ width: WIDTHS.at(-1), height: 900 });
          if (!isAdmin) await page.goto(url(locale, route), { waitUntil: 'networkidle' });
          const walk = [];
          for (let i = 0; i < TAB; i++) {
            await page.keyboard.press('Tab');
            // Under reduced motion base.css squeezes every transition to 0.01ms, and the default
            // transition-property is `all` — so the focus outline still animates in from 0px for one
            // frame. Read it once it has landed.
            await page.waitForTimeout(60);
            walk.push(
              await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return { tag: 'body' };
                const cs = getComputedStyle(el);
                const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
                return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50), visibleFocus: visible };
              }),
            );
          }
          const invisible = walk.filter((w) => w.tag !== 'body' && !w.visibleFocus);
          if (invisible.length) problems.push(`${locale} ${route}: ${invisible.length} focus stop(s) with no visible indicator`);
          writeFileSync(join(OUT, `${locale}-${slug(raw)}-tab.json`), JSON.stringify(walk, null, 2));
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

function url(locale, route) {
  return `http://localhost:${PORT}/${locale}${route === '/' ? '/' : route}`;
}

writeFileSync(join(OUT, 'INDEX.md'), ['| locale | route | theme | width | file |', '|---|---|---|---|---|', ...index].join('\n') + '\n');
console.log(`screenshots: ${index.length} captures written to ${OUT}`);
if (problems.length) {
  console.error(`screenshots: ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
