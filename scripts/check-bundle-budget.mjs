#!/usr/bin/env node
/**
 * Angular's own `angular.json` budgets measure RAW (uncompressed) bytes — there is no
 * built-in option to budget gzip/transfer size. The project's actual targets (400 KB
 * initial transfer, 150 KB initial JS — see docs/architecture/02-frontend-architecture.md,
 * "Performance budget") are stated as gzipped sizes, matching how they're measured in
 * production (Hostinger serves static files with gzip on). This script computes the real
 * gzip size of each locale's initial chunks and fails the build if either target is missed.
 * It runs as a postbuild step, immediately after `ng build`'s own (RAW-byte) budgets.
 *
 * "Initial" is derived from the home page's own index.html — every `<script src>` and
 * `<link rel="modulepreload">` it references — rather than a `main`/`polyfills`/`scripts`
 * filename guess. That guess silently missed a real 248 KB shared chunk once Angular's
 * bundler split one out at this app's size: the chunk isn't named `main-*` but IS
 * modulepreloaded (eagerly fetched before first paint), so it belongs in this count. The
 * script bundle graph is identical across every prerendered page (only body content
 * differs), so any one route's index.html is representative — the home page is used
 * because NFR-01 frames the budget in terms of "the landing route".
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const KB = 1000; // matches Angular's own BYTES_IN_KILOBYTE convention
const MAX_INITIAL_JS = 150 * KB;
const MAX_INITIAL_TOTAL = 400 * KB;

function gzipSize(path) {
  return gzipSync(readFileSync(path)).length;
}

function formatKb(bytes) {
  return `${(bytes / KB).toFixed(1)} kB`;
}

/** Local (no scheme, no query) filenames referenced by a tag+attribute pair, deduped. */
function extractLocalHrefs(html, tagAttrRe) {
  const names = new Set();
  for (const match of html.matchAll(tagAttrRe)) {
    const href = match[1];
    if (href && !href.includes('://')) names.add(href);
  }
  return names;
}

let locales;
try {
  locales = readdirSync(BROWSER_DIR).filter((name) => ['ar', 'en'].includes(name) && statSync(join(BROWSER_DIR, name)).isDirectory());
} catch (err) {
  console.error(`check-bundle-budget: could not read ${BROWSER_DIR} — did \`ng build\` run first?`);
  console.error(err.message);
  process.exit(1);
}

if (locales.length === 0) {
  console.error(`check-bundle-budget: no locale output folders found under ${BROWSER_DIR}`);
  process.exit(1);
}

let failed = false;

for (const locale of locales) {
  const dir = join(BROWSER_DIR, locale);
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) {
    console.error(`check-bundle-budget: ${indexPath} not found — was the home route prerendered for "${locale}"?`);
    process.exit(1);
  }
  const html = readFileSync(indexPath, 'utf8');

  const scriptSrcs = extractLocalHrefs(html, /<script[^>]*\ssrc="([^"]+)"/g);
  const modulePreloads = extractLocalHrefs(html, /<link[^>]*\srel="modulepreload"[^>]*\shref="([^"]+)"/g);
  const jsFiles = [...new Set([...scriptSrcs, ...modulePreloads])].filter((f) => f.endsWith('.js'));
  const cssFiles = [...extractLocalHrefs(html, /<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"/g)];

  const jsGzip = jsFiles.reduce((sum, f) => sum + gzipSize(join(dir, f)), 0);
  const cssGzip = cssFiles.reduce((sum, f) => sum + gzipSize(join(dir, f)), 0);
  const totalGzip = jsGzip + cssGzip;

  const jsOk = jsGzip <= MAX_INITIAL_JS;
  const totalOk = totalGzip <= MAX_INITIAL_TOTAL;

  console.log(
    `[${locale}] initial JS (gzip): ${formatKb(jsGzip)} / ${formatKb(MAX_INITIAL_JS)}` +
      `  ·  initial transfer (gzip): ${formatKb(totalGzip)} / ${formatKb(MAX_INITIAL_TOTAL)}` +
      `  ${jsOk && totalOk ? 'OK' : 'FAIL'}`,
  );

  if (!jsOk) {
    console.error(
      `  ✗ initial JS exceeds budget by ${formatKb(jsGzip - MAX_INITIAL_JS)} (files: ${jsFiles.join(', ')})`,
    );
    failed = true;
  }
  if (!totalOk) {
    console.error(`  ✗ initial transfer exceeds budget by ${formatKb(totalGzip - MAX_INITIAL_TOTAL)}`);
    failed = true;
  }
}

if (failed) {
  console.error('\ncheck-bundle-budget: FAILED — fix the cause, do not raise these numbers.');
  process.exit(1);
}
