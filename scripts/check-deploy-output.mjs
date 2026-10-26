#!/usr/bin/env node
/**
 * Build gate: the static web root has everything the host needs, and every file is world-readable.
 *   - E-1: every route in routes.txt has its prerendered index.html; each locale has its client shell
 *     (`index.csr.html`) that the host serves, `no-cache`, for every other path (new projects, cart, account, admin…);
 *     deploy/README.md carries those host rules.
 *   - C-1: with EXPECT_API_URL (set by `npm run build:prod`), the compiled app talks to that API — even when the
 *     prerender read its data elsewhere (PRERENDER_API_URL) — and the CSP's connect-src allows its origin.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
const REQUIRED = ['index.html', 'sitemap.xml', 'robots.txt', 'ar/index.html', 'en/index.html', 'ar/index.csr.html', 'en/index.csr.html'];
const problems = [];
if (!existsSync(BROWSER_DIR)) {
  console.error('check-deploy-output: dist/store-web/browser not found — build first.');
  process.exit(1);
}
for (const f of REQUIRED) {
  const p = join(BROWSER_DIR, f);
  if (!existsSync(p)) problems.push(`${f} is missing`);
  else if (statSync(p).size === 0) problems.push(`${f} is empty`);
}
if (existsSync(join(BROWSER_DIR, 'index.html')) && readFileSync(join(BROWSER_DIR, 'index.html'), 'utf8') !== readFileSync('deploy/index.html', 'utf8')) {
  problems.push('index.html differs from deploy/index.html');
}
// E-1: prerendered routes and the documented client fallback.
if (existsSync('routes.txt')) {
  for (const route of readFileSync('routes.txt', 'utf8').split('\n').filter(Boolean)) {
    const f = join(BROWSER_DIR, route.replace(/^\//, ''), 'index.html');
    if (!existsSync(f)) problems.push(`prerendered page missing for ${route}`);
  }
}
const readme = readFileSync('deploy/README.md', 'utf8');
for (const loc of ['ar', 'en'])
  if (!readme.includes(`/${loc}/index.csr.html`)) problems.push(`deploy/README.md lacks the /${loc}/index.csr.html fallback rule`);
if (!/@html[\s\S]*no-cache/.test(readme)) problems.push('deploy/README.md lacks the no-cache rule for HTML (index.csr.html)');

// C-1: the runtime API compiled into the app, and allowed by the CSP.
const expected = process.env.EXPECT_API_URL;
if (expected) {
  const js = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.js')) js.push(p);
    }
  };
  walk(BROWSER_DIR);
  if (!js.some((f) => readFileSync(f, 'utf8').includes(expected)))
    problems.push(`no JS bundle contains the runtime API URL ${expected}`);
  const csp = readFileSync('deploy/caddy-headers.conf', 'utf8');
  const connect = /connect-src ([^;]+);/.exec(csp)?.[1] ?? '';
  if (!connect.split(/\s+/).includes(new URL(expected).origin))
    problems.push(`CSP connect-src does not allow ${new URL(expected).origin}`);
}

const check = (p) => {
  const s = statSync(p);
  const need = s.isDirectory() ? 0o005 : 0o004;
  if ((s.mode & need) !== need) problems.push(`${relative(BROWSER_DIR, p) || '(root)'} mode ${(s.mode & 0o777).toString(8)}`);
  if (s.isDirectory()) for (const n of readdirSync(p)) check(join(p, n));
};
check(BROWSER_DIR);
if (problems.length) {
  console.error(`check-deploy-output: not safe to publish:\n  - ${problems.slice(0, 20).join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `check-deploy-output: ${REQUIRED.length} required files and every prerendered route present; client fallback documented; every file readable${expected ? `; runtime API ${expected} compiled in and allowed by the CSP` : ''}.`,
);
