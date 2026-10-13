#!/usr/bin/env node
/** Build gate: the static web root has everything the host needs, and every file is world-readable. */
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
console.log(`check-deploy-output: ${REQUIRED.length} required files present; every file readable, every directory traversable.`);
