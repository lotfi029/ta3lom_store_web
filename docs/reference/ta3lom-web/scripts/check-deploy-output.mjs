#!/usr/bin/env node
/**
 * Refuses to finish a build whose output would answer "403 Forbidden" on Hostinger.
 *
 * Runs in every build (`build` and `build:ci`, after postbuild.mjs). Hostinger's Git build runs
 * `npm run build`, so a failure here fails the deploy instead of publishing it.
 *
 * Two of the ways this site has served a plain 403 can be caught in the build output itself:
 *
 *   - NO INDEX FOR THE BARE DOMAIN. Every page lives under /ar/ or /en/. The web root is served by
 *     .htaccess's redirect, with deploy/index.html as the fallback (postbuild.mjs copies both).
 *     Lose both and LiteSpeed refuses to list the directory: 403 on https://ta3lom.sa/.
 *   - UNREADABLE FILES. Hostinger serves the web root as another user, so a file that is not
 *     world-readable, or a directory that is not world-traversable, is a 403 for that path.
 *
 * The rest (the CDN switched back on, a disabled website, hPanel IP or country blocks) are hPanel
 * settings no build can see.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BROWSER_DIR = join(process.cwd(), 'dist', 'ta3lom', 'browser');
const REQUIRED = ['.htaccess', 'index.html', 'sitemap.xml', 'robots.txt', 'ar/index.html', 'en/index.html'];

const problems = [];

if (!existsSync(BROWSER_DIR)) {
  console.error(`check-deploy-output: ${BROWSER_DIR} not found — run the build first.`);
  process.exit(1);
}

for (const file of REQUIRED) {
  const path = join(BROWSER_DIR, file);
  if (!existsSync(path)) problems.push(`${file} is missing`);
  else if (statSync(path).size === 0) problems.push(`${file} is empty`);
}

// The deployed copy must be the checked-in one: postbuild copies it, nothing else may edit it.
for (const file of ['.htaccess', 'index.html']) {
  const built = join(BROWSER_DIR, file);
  const source = join(process.cwd(), 'deploy', file);
  if (existsSync(built) && readFileSync(built, 'utf8') !== readFileSync(source, 'utf8')) {
    problems.push(`${file} differs from deploy/${file}`);
  }
}

function checkModes(path) {
  const stat = statSync(path);
  const isDir = stat.isDirectory();
  // Others need read on files, and read + execute (traverse) on directories.
  const needed = isDir ? 0o005 : 0o004;
  if ((stat.mode & needed) !== needed) {
    const name = relative(BROWSER_DIR, path) || '(web root)';
    problems.push(`${name}${isDir ? '/' : ''} has mode ${(stat.mode & 0o777).toString(8)} — not ${isDir ? 'traversable' : 'readable'} by the web server`);
  }
  if (isDir) for (const name of readdirSync(path)) checkModes(join(path, name));
}
checkModes(BROWSER_DIR);

if (problems.length > 0) {
  console.error('check-deploy-output: not safe to publish — this web root would answer 403 Forbidden, or ships a file that is not the checked-in one:');
  for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  process.exit(1);
}

console.log(`check-deploy-output: web root has ${REQUIRED.join(', ')}; every file readable, every directory traversable.`);
