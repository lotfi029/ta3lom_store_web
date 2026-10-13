#!/usr/bin/env node
/**
 * Build gate (runs after postbuild in `npm run build` / `build:ci`): the CSP in deploy/caddy-headers.conf
 * must allow EXACTLY the inline scripts the build emits, and the build must emit nothing that
 * only 'unsafe-inline' would allow (CR-01 FE-1, ADR-011).
 *
 * Walks every built HTML page in both locales and fails when:
 *   - an inline executable <script> has a sha256 that is not in script-src — this is the "the
 *     theme script and its hash drifted" guard; it prints the exact token to paste;
 *   - script-src lists a hash that no page uses any more (stale — tidy it away);
 *   - any element carries an inline event-handler attribute (onload=, onclick=, …) or a
 *     `javascript:` URL — a hash cannot allow those, and 'unsafe-hashes' is not in the policy;
 *   - script-src contains 'unsafe-inline' or 'unsafe-eval'.
 *
 * Data blocks (`type="application/json"`, `application/ld+json` — Angular's ng-state and the SEO
 * JSON-LD) are not scripts and CSP does not apply to them, so they are skipped.
 * The hash is over the element's text exactly as served — the bytes in the built file.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { directives, readCsp } from './lib/csp.mjs';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

if (!existsSync(BROWSER_DIR)) {
  console.error('check-csp: dist/store-web/browser not found — build first.');
  process.exit(1);
}

const scriptSrc = directives(readCsp())['script-src'] ?? [];
const allowed = new Set(scriptSrc.filter((v) => v.startsWith("'sha256-")));
const problems = [];
if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) {
  problems.push("script-src must never contain 'unsafe-inline' or 'unsafe-eval'");
}

const used = new Map(); // token -> first page it appeared on
let pages = 0;
// Both locale trees, plus the web-root fallback page (deploy/index.html, copied by postbuild.mjs).
const rootPages = readdirSync(BROWSER_DIR).filter((name) => name.endsWith('.html')).map((name) => join(BROWSER_DIR, name));
for (const files of [htmlFiles(join(BROWSER_DIR, 'ar')), htmlFiles(join(BROWSER_DIR, 'en')), rootPages]) {
  for (const file of files) {
    pages += 1;
    const page = relative(BROWSER_DIR, file);
    // Comments first: a comment may legitimately mention "<script>" or "onload=".
    const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = m[1];
      if (/\ssrc\s*=/i.test(attrs)) continue;
      const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
      if (type && DATA_TYPES.has(type)) continue;
      const token = `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
      if (!used.has(token)) used.set(token, { page, preview: m[2].slice(0, 70).replace(/\s+/g, ' ') });
    }

    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    for (const m of markup.matchAll(/<[a-z][\w-]*\s[^>]*?\s(on[a-z]+)\s*=/gi)) {
      problems.push(`${page}: inline event handler ${m[1]}= — CSP blocks it; move it into code`);
    }
    if (/\s(?:href|src|action)\s*=\s*["']\s*javascript:/i.test(markup)) problems.push(`${page}: a javascript: URL`);
  }
}

for (const [token, where] of used) {
  if (!allowed.has(token)) {
    problems.push(`inline script not allowed by deploy/caddy-headers.conf — add ${token} to script-src\n      (first seen in ${where.page}: "${where.preview}…")`);
  }
}
for (const token of allowed) {
  if (!used.has(token)) problems.push(`script-src lists ${token}, which no built page uses — remove it`);
}

if (problems.length) {
  console.error(`check-csp: ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check-csp: ${pages} pages, ${used.size} inline script hash(es), all allowed by deploy/caddy-headers.conf; no inline handlers.`);
