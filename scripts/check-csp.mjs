#!/usr/bin/env node
/**
 * Build gate (after gen-csp.mjs in `postbuild:checks`): the generated policy (dist/store-web/caddy/csp.conf, owner H-3)
 * allows EXACTLY the inline scripts the build emits and nothing that only 'unsafe-inline' would allow (CR-01 FE-1).
 * Fails when:
 *   - an inline executable <script> has a sha256 that is not in script-src, or script-src lists a hash no page uses;
 *   - any element carries an inline event-handler attribute (onload=, onclick=, …) or a `javascript:` URL;
 *   - script-src contains 'unsafe-inline' or 'unsafe-eval';
 *   - connect-src does not allow exactly 'self' + the environment's API origin (+ the error-report origin when set);
 *   - frame-ancestors is not 'none'.
 * Data blocks (`application/json`, `application/ld+json`) are not scripts and are skipped.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BROWSER_DIR, directives, htmlFiles, inlineScriptHashes, readCsp } from './lib/csp.mjs';
import { deployEnv } from './lib/envs.mjs';

const env = deployEnv();
const d = directives(readCsp());
const scriptSrc = d['script-src'] ?? [];
const allowed = new Set(scriptSrc.filter((v) => v.startsWith("'sha256-")));
const problems = [];
if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'"))
  problems.push("script-src must never contain 'unsafe-inline' or 'unsafe-eval'");
if ((d['frame-ancestors'] ?? []).join(' ') !== "'none'") problems.push("frame-ancestors must be 'none'");

const api = new URL(env.apiUrl).origin;
const report = env.errorReportUrl ? new URL(env.errorReportUrl).origin : null;
const wantConnect = ["'self'", api, ...(report && report !== api ? [report] : [])].sort().join(' ');
const haveConnect = [...(d['connect-src'] ?? [])].sort().join(' ');
if (haveConnect !== wantConnect)
  problems.push(`connect-src is "${haveConnect}", expected "${wantConnect}" for DEPLOY_ENV=${env.name}`);

const used = inlineScriptHashes(BROWSER_DIR);
const pages = htmlFiles(BROWSER_DIR);
for (const file of pages) {
  const page = relative(BROWSER_DIR, file);
  const markup = readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  for (const m of markup.matchAll(/<[a-z][\w-]*\s[^>]*?\s(on[a-z]+)\s*=/gi))
    problems.push(`${page}: inline event handler ${m[1]}= — CSP blocks it; move it into code`);
  if (/\s(?:href|src|action)\s*=\s*["']\s*javascript:/i.test(markup)) problems.push(`${page}: a javascript: URL`);
}
for (const [token, where] of used)
  if (!allowed.has(token)) problems.push(`inline script ${token} not in the generated script-src (${where.page})`);
for (const token of allowed) if (!used.has(token)) problems.push(`script-src lists ${token}, which no page uses`);

if (problems.length) {
  console.error(`check-csp: ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `check-csp: [${env.name}] ${pages.length} pages, ${used.size} inline script hash(es) allowed by the generated policy; connect-src ${wantConnect}; no inline handlers.`,
);
