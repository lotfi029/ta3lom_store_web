#!/usr/bin/env node
/**
 * Runs after `ng build` (part of `npm run build`). For the dual-locale static output (dist/store-web/browser):
 *   - copies sitemap.xml, robots.txt and the favicons to the web root (the root has no locale of its own);
 *   - copies deploy/index.html to the web root: a script-free fallback page (Caddy redirects / → /ar/ before it is read);
 *   - preloads the Arabic Readex Pro face on every page (Angular fingerprints it, so index.html can't name it);
 *   - rewrites Angular's inline event-dispatch bootstrap to ONE canonical superset call, so the site has exactly one
 *     CSP hash for it (its text otherwise varies by page content);
 *   - normalises modes (0644 files, 0755 dirs).
 */
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');

function copyToRoot(name, sourceDir = join(BROWSER_DIR, 'ar')) {
  const src = join(sourceDir, name);
  if (!existsSync(src)) {
    console.error(`postbuild: ${src} missing — did routes.mjs run before the build?`);
    process.exitCode = 1;
    return;
  }
  copyFileSync(src, join(BROWSER_DIR, name));
}
for (const f of ['sitemap.xml', 'robots.txt', 'favicon.ico', 'favicon.svg']) copyToRoot(f);
copyToRoot('index.html', join(process.cwd(), 'deploy'));

const JSACTION_BUBBLE = ['click', 'dblclick', 'focusin', 'focusout', 'submit', 'input', 'change', 'keydown', 'keyup', 'pointerdown', 'pointerup'];
const JSACTION_CAPTURE = ['focus', 'blur'];
const JSACTION_CALL = /window\.__jsaction_bootstrap\(document\.body,"ng",(\[[^\]]*\]),(\[[^\]]*\])\)/g;
const CANONICAL = `window.__jsaction_bootstrap(document.body,"ng",${JSON.stringify(JSACTION_BUBBLE)},${JSON.stringify(JSACTION_CAPTURE)})`;
const canonical = (html) =>
  html.replace(JSACTION_CALL, (call, bubble, capture) => {
    const fits = (list, allowed) => JSON.parse(list).every((t) => allowed.includes(t));
    return fits(bubble, JSACTION_BUBBLE) && fits(capture, JSACTION_CAPTURE) ? CANONICAL : call;
  });

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : name.endsWith('.html') ? [p] : [];
  });

for (const locale of ['ar', 'en']) {
  const dir = join(BROWSER_DIR, locale);
  const media = join(dir, 'media');
  const font = existsSync(media) ? readdirSync(media).find((n) => /^readex-pro-arabic-wght-[A-Z0-9]+\.woff2$/.test(n)) : undefined;
  if (!font) {
    console.error(`postbuild: no readex-pro-arabic-wght-*.woff2 in ${relative(process.cwd(), media)}`);
    process.exitCode = 1;
    continue;
  }
  const tag = `<link rel="preload" href="media/${font}" as="font" type="font/woff2" crossorigin>`;
  let count = 0;
  for (const file of htmlFiles(dir)) {
    const original = readFileSync(file, 'utf8');
    let html = canonical(original);
    if (!html.includes(tag) && html.includes('</head>')) {
      html = html.replace('</head>', `${tag}</head>`);
      count += 1;
    }
    if (html !== original) writeFileSync(file, html);
  }
  console.log(`postbuild: [${locale}] font preload added to ${count} page(s)`);
}

const modes = (dir) => {
  chmodSync(dir, 0o755);
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) modes(p);
    else chmodSync(p, 0o644);
  }
};
modes(BROWSER_DIR);
console.log('postbuild: web root files copied, modes normalised (dist/store-web/browser)');
