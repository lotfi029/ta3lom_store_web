#!/usr/bin/env node
/**
 * Runs after `ng build` (see the "build"/"build:ci" scripts in package.json). Fixes the two
 * things a dual-locale prerendered static site (ADR-002) has no shared root for by default:
 *
 *   - sitemap.xml and robots.txt land in public/, so Angular's asset pipeline copies them
 *     into BOTH dist/ta3lom/browser/ar/ and /en/ (there is no root-level index for a static
 *     multi-locale build) — but robots.txt's own `Sitemap:` line points at
 *     ${SITE_ORIGIN}/sitemap.xml, a bare-domain path neither locale folder serves. This copies
 *     either locale's identical copy (routes.mjs generates one combined sitemap covering both
 *     locales regardless of which folder it's read from) up to the dist root so that path
 *     actually resolves.
 *   - favicon.ico and favicon.svg are copied into both locale folders by the asset pipeline,
 *     and each page's own <link rel="icon"> resolves against <base href="/ar/"> or "/en/", so
 *     a browser on a real page is served correctly either way. Copying them to the root as
 *     well answers the bare-domain /favicon.ico that clients which never parse the HTML (feed
 *     readers, some bookmark and link-preview tools) request by convention — no rule in
 *     deploy/.htaccess serves that path otherwise.
 *   - deploy/.htaccess (checked into the repo, not generated) is copied to the dist root,
 *     where Hostinger's static hosting reads it. It redirects the bare domain to /ar/ for every
 *     visitor (x-default is /ar/, per sitemap.xml) and 301s the handful of known
 *     retired WordPress/WooCommerce paths (FR-04) — see that file's own header comment for
 *     what it does and does not cover.
 *   - deploy/index.html is copied to the dist root too: a static, script-free page linking to
 *     /ar/ and /en/. It is normally never served — .htaccess redirects the bare domain before the
 *     server looks for an index — but without it a web root that lost its .htaccess (or runs
 *     without mod_rewrite) has no index at all and answers "403 Forbidden" to every visitor.
 *   - every file is made 0644 and every directory 0755. Hostinger serves the web root as another
 *     user, and a deploy archive keeps whatever modes the build machine's umask produced; a file
 *     that is not world-readable is a 403 on the live host. scripts/check-deploy-output.mjs
 *     then verifies all of this before the build is allowed to finish.
 *   - (CR-01 FE-1) every built HTML page gets `<link rel="preload">` for the Arabic Readex Pro
 *     file. Angular fingerprints fonts referenced from fonts.css (`media/…-HASH.woff2`), so
 *     src/index.html cannot name the file; this finds each locale's own hashed copy and inserts
 *     the tag just before </head>. Only the Arabic file: Arabic is the primary language and the
 *     one face every /ar page paints with; Latin loads on demand through unicode-range.
 *   - (CR-01 FE-1) Angular's inline event-replay bootstrap —
 *     `window.__jsaction_bootstrap(document.body,"ng",[bubble events],[capture events])` — lists
 *     only the event types the page happens to listen for, so its text (and so its CSP hash)
 *     varies by page and by CONTENT: a production rebuild could emit a variant CI never saw, and
 *     the browser would block it. Every page's call is rewritten to one fixed, ordered superset
 *     below, so the site has exactly one hash for it. Listening for extra types is harmless: the
 *     early contract only stashes events on elements that carry a matching jsaction attribute.
 *     A page needing a type outside the set is left untouched, and scripts/check-csp.mjs then
 *     fails the build naming it — add the type to JSACTION_* here.
 */
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BROWSER_DIR = join(process.cwd(), 'dist', 'ta3lom', 'browser');
const SOURCE_LOCALE = 'ar'; // routes.mjs's sourceLocale — its sitemap.xml/robots.txt are identical to en's

function copyToRoot(relativePath, sourceDir = join(BROWSER_DIR, SOURCE_LOCALE)) {
  const src = join(sourceDir, relativePath);
  const dest = join(BROWSER_DIR, relativePath);
  if (!existsSync(src)) {
    console.error(`postbuild: expected ${src} to exist — did routes.mjs run before the build?`);
    process.exitCode = 1;
    return;
  }
  copyFileSync(src, dest);
  console.log(`postbuild: copied ${relativePath} -> dist/ta3lom/browser/${relativePath}`);
}

copyToRoot('sitemap.xml');
copyToRoot('robots.txt');
copyToRoot('favicon.ico');
copyToRoot('favicon.svg');
copyToRoot('.htaccess', join(process.cwd(), 'deploy'));
copyToRoot('index.html', join(process.cwd(), 'deploy'));

const JSACTION_BUBBLE = ['click', 'dblclick', 'focusin', 'focusout', 'submit', 'input', 'change', 'keydown', 'keyup', 'pointerdown', 'pointerup'];
const JSACTION_CAPTURE = ['focus', 'blur'];
const JSACTION_CALL = /window\.__jsaction_bootstrap\(document\.body,"ng",(\[[^\]]*\]),(\[[^\]]*\])\)/g;
const CANONICAL_CALL = `window.__jsaction_bootstrap(document.body,"ng",${JSON.stringify(JSACTION_BUBBLE)},${JSON.stringify(JSACTION_CAPTURE)})`;

function canonicalJsaction(html) {
  return html.replace(JSACTION_CALL, (call, bubble, capture) => {
    const fits = (list, allowed) => JSON.parse(list).every((type) => allowed.includes(type));
    return fits(bubble, JSACTION_BUBBLE) && fits(capture, JSACTION_CAPTURE) ? CANONICAL_CALL : call;
  });
}

const PRELOAD_FONT = /^readex-pro-arabic-wght-[A-Z0-9]+\.woff2$/;

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

for (const locale of ['ar', 'en']) {
  const localeDir = join(BROWSER_DIR, locale);
  const mediaDir = join(localeDir, 'media');
  const font = existsSync(mediaDir) ? readdirSync(mediaDir).find((name) => PRELOAD_FONT.test(name)) : undefined;
  if (!font) {
    console.error(`postbuild: no readex-pro-arabic-wght-*.woff2 in dist/ta3lom/browser/${locale}/media — did fonts.css change?`);
    process.exitCode = 1;
    continue;
  }
  // Relative to <base href="/ar/"> (or /en/), which every page — prerendered or index.csr — carries.
  const tag = `<link rel="preload" href="media/${font}" as="font" type="font/woff2" crossorigin>`;
  let count = 0;
  for (const file of htmlFiles(localeDir)) {
    const original = readFileSync(file, 'utf8');
    let html = canonicalJsaction(original);
    if (!html.includes(tag) && html.includes('</head>')) {
      html = html.replace('</head>', `${tag}</head>`);
      count += 1;
    }
    if (html !== original) writeFileSync(file, html);
  }
  console.log(`postbuild: preloaded ${font} in ${count} ${locale} page(s) (${relative(process.cwd(), localeDir)})`);
}

// Last, so it also covers every file written above.
function normaliseModes(dir) {
  chmodSync(dir, 0o755);
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) normaliseModes(path);
    else chmodSync(path, 0o644);
  }
}
normaliseModes(BROWSER_DIR);
console.log('postbuild: set every file to 0644 and every directory to 0755 (dist/ta3lom/browser)');
