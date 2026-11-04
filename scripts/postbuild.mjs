#!/usr/bin/env node
/**
 * Runs after `ng build` (part of `npm run build`). For the dual-locale static output (dist/store-web/browser):
 *   - copies robots.txt, sitemap.xml (none on staging) and the favicons to the web root (the root has no locale of its own);
 *   - copies deploy/index.html (script-free fallback; Caddy redirects / → /ar/ before it is read) and deploy/404.html (the
 *     static 404 for paths outside /ar and /en) to the web root;
 *   - copies deploy/well-known/apple-developer-merchantid-domain-association to /.well-known/ (Apple Pay, review 04);
 *   - build stamp: /version.json { version, commit, builtAt, env } and <meta name="build"> on every page — no secrets
 *     (BUILD_VERSION / BUILD_SHA from the image build args, else git);
 *   - preloads the Readex Pro faces and Plex Mono 400 on every page (Angular fingerprints them, so index.html can't);
 *   - rewrites Angular's inline event-dispatch bootstrap to ONE canonical superset call, so the site has exactly one
 *     CSP hash for it (its text otherwise varies by page content);
 *   - (F6.1) critical CSS is inlined by Angular (beasties): the full sheet loads as `media="print"
 *     data-beasties-media="all"` and ONE inline script at the end of <body> switches it — no inline handler; gen-csp
 *     hashes that script like every other, check-csp verifies it;
 *   - (F6.2) inlines the locale's @font-face rules (~1.7 KB) in every page's <head>: the critical CSS (F6.1) leaves them
 *     in the async sheet, so the first paint used system fonts and the text reflowed when the sheet arrived (CLS 0.086
 *     on /en/). `./media/…` resolves against `<base href="/{locale}/">`;
 *   - (F6.4) `<link rel="preconnect">` to the environment's API origin (catalogue images, including the LCP banner/cover
 *     image, and the data reload after hydration come from there); no `crossorigin`: images and the credentialed
 *     fetches share that connection pool;
 *   - keeps a `<link rel="modulepreload">` only for chunks the entry scripts import STATICALLY: Angular 22.2.4+ also
 *     preloads the current route's lazy chunks, which loads them before first paint and pushed initial JS over the
 *     150 kB budget (Angular group update #21). Those chunks still load, as before, when the route asks for them;
 *   - normalises modes (0644 files, 0755 dirs).
 */
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { deployEnv } from './lib/envs.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const APPLE_PAY_FILE = 'apple-developer-merchantid-domain-association';

function copyToRoot(name, sourceDir = join(BROWSER_DIR, 'ar')) {
  const src = join(sourceDir, name);
  if (!existsSync(src)) {
    console.error(`postbuild: ${src} missing — did routes.mjs run before the build?`);
    process.exitCode = 1;
    return;
  }
  copyFileSync(src, join(BROWSER_DIR, name));
}
const ENV = deployEnv();
for (const f of ['robots.txt', 'favicon.ico', 'favicon.svg']) copyToRoot(f);
if (ENV.robots !== 'noindex') copyToRoot('sitemap.xml');
copyToRoot('index.html', join(process.cwd(), 'deploy'));
copyToRoot('404.html', join(process.cwd(), 'deploy'));
// Apple Pay on Moyasar's hosted page: the domain association file at the web root (review 04). The repository holds a
// placeholder; check-deploy-output fails a real production build until the owner puts Moyasar's file in its place.
mkdirSync(join(BROWSER_DIR, '.well-known'), { recursive: true });
copyFileSync(
  join(process.cwd(), 'deploy', 'well-known', APPLE_PAY_FILE),
  join(BROWSER_DIR, '.well-known', APPLE_PAY_FILE),
);

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const STAMP = {
  version: process.env.BUILD_VERSION || git('describe', '--tags', '--always', '--dirty') || 'dev',
  commit: process.env.BUILD_SHA || git('rev-parse', 'HEAD') || 'unknown',
  builtAt: new Date().toISOString(),
  env: ENV.name,
};
writeFileSync(join(BROWSER_DIR, 'version.json'), `${JSON.stringify(STAMP)}\n`);
const BUILD_META = `<meta name="build" content="${STAMP.version} ${STAMP.commit.slice(0, 12)} ${STAMP.env}">`;

const JSACTION_BUBBLE = [
  'click',
  'dblclick',
  'focusin',
  'focusout',
  'submit',
  'input',
  'change',
  'keydown',
  'keyup',
  'pointerdown',
  'pointerup',
];
const JSACTION_CAPTURE = ['focus', 'blur'];
const JSACTION_CALL =
  /window\.__jsaction_bootstrap\(document\.body,"ng",(\[[^\]]*\]),(\[[^\]]*\])\)/g;
const CANONICAL = `window.__jsaction_bootstrap(document.body,"ng",${JSON.stringify(JSACTION_BUBBLE)},${JSON.stringify(JSACTION_CAPTURE)})`;
const canonical = (html) =>
  html.replace(JSACTION_CALL, (call, bubble, capture) => {
    const fits = (list, allowed) => JSON.parse(list).every((t) => allowed.includes(t));
    return fits(bubble, JSACTION_BUBBLE) && fits(capture, JSACTION_CAPTURE) ? CANONICAL : call;
  });

/** The chunks the page's entry scripts (`<script type="module" src>`) import statically, transitively. */
const STATIC_IMPORT = /(?:^|[;}\s])import\s*(?:[^"'();]*?from\s*)?["']\.\/([^"']+\.js)["']/g;
function staticClosure(dir, entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !existsSync(join(dir, f))) continue;
    seen.add(f);
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(STATIC_IMPORT)) queue.push(m[1]);
  }
  return seen;
}
const entryScripts = (html) =>
  [...html.matchAll(/<script src="([^"]+\.js)" type="module">/g)].map((m) => m[1]);
/** Drops modulepreload links for chunks outside the static closure (lazy-route preloads). */
function initialPreloadsOnly(dir, html) {
  const keep = staticClosure(dir, entryScripts(html));
  if (keep.size === 0) return html;
  return html.replace(/<link rel="modulepreload" href="([^"]+)">/g, (tag, href) => (keep.has(href) ? tag : ''));
}

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : name.endsWith('.html') ? [p] : [];
  });

// Preloaded faces (owner brief P4): Readex Pro only, the page's own script first. Arabic pages ALSO preload the Latin
// subset: Arabic text uses it for digits, spaces and punctuation (W-11), and without it the banner title re-painted
// when that face arrived — LCP 3.8 s on /ar/ in CI. English pages preload Latin only; Plex Mono loads on demand.
const PRELOAD = {
  ar: [/^readex-pro-arabic-wght-[A-Z0-9]+\.woff2$/, /^readex-pro-latin-wght-[A-Z0-9]+\.woff2$/],
  en: [/^readex-pro-latin-wght-[A-Z0-9]+\.woff2$/],
};

for (const locale of ['ar', 'en']) {
  const dir = join(BROWSER_DIR, locale);
  const media = join(dir, 'media');
  const names = existsSync(media) ? readdirSync(media) : [];
  const fonts = PRELOAD[locale].map((re) => names.find((n) => re.test(n)));
  if (fonts.some((f) => !f)) {
    console.error(`postbuild: a preloaded font is missing from ${relative(process.cwd(), media)}`);
    process.exitCode = 1;
    continue;
  }
  const sheet = readdirSync(dir).find((n) => /^styles-[A-Z0-9]+\.css$/.test(n));
  const faces = sheet ? (readFileSync(join(dir, sheet), 'utf8').match(/@font-face\{[^}]*\}/g) ?? []) : [];
  if (faces.length === 0) {
    console.error(`postbuild: no @font-face rule found in ${locale}/${sheet ?? 'styles-*.css'}`);
    process.exitCode = 1;
    continue;
  }
  const fontStyle = `<style data-fonts>${faces.join('')}</style>`;
  const preconnect = `<link rel="preconnect" href="${new URL(ENV.apiUrl).origin}">`;
  const tags =
    preconnect +
    fonts.map((f) => `<link rel="preload" href="media/${f}" as="font" type="font/woff2" crossorigin>`).join('') +
    fontStyle;
  let count = 0;
  for (const file of htmlFiles(dir)) {
    const original = readFileSync(file, 'utf8');
    let html = initialPreloadsOnly(dir, canonical(original))
      .replace(/<meta name="build" content="[^"]*">/g, '')
      .replace(/<link rel="preload" href="media\/[^"]+\.woff2" as="font" type="font\/woff2" crossorigin>/g, '')
      .replace(/<style data-fonts>[^<]*<\/style>/g, '')
      .replace(/<link rel="preconnect" href="[^"]+">/g, '');
    if (!html.includes(tags) && html.includes('</head>')) {
      // Right after <base href> (the relative media/ URLs resolve against it, so never before it) and before Angular's
      // modulepreloaded JS: the fonts (~40 kB) no longer queue behind the scripts.
      html = /<base href="[^"]*">/.test(html)
        ? html.replace(/(<base href="[^"]*">)/, `$1${tags}`)
        : html.replace('</head>', `${tags}</head>`);
      count += 1;
    }
    if (html.includes('</head>')) html = html.replace('</head>', `${BUILD_META}</head>`);
    if (html !== original) writeFileSync(file, html);
  }
  console.log(`postbuild: [${locale}] font preloads + ${faces.length} inline @font-face rules added to ${count} page(s)`);
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
console.log(`postbuild: [${ENV.name}] web root files copied, build ${STAMP.version} (${STAMP.commit.slice(0, 12)}), modes normalised`);
