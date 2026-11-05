#!/usr/bin/env node
/**
 * Build gate: the static web root is complete and right FOR ITS ENVIRONMENT (DEPLOY_ENV, scripts/lib/envs.mjs).
 *   - E-1: every route in routes.txt has its prerendered index.html; each locale has its client shell (`index.csr.html`);
 *     the root has index.html, 404.html, robots.txt, version.json; deploy/Caddyfile carries the fallback + no-cache rules.
 *   - apiUrl: the compiled app talks to the environment's API (C-1 — even when the prerender read elsewhere) and the
 *     generated CSP's connect-src allows exactly that origin (+ the error-report origin when set).
 *   - canonical host: the prerendered home's canonical / hreflang point at the environment's site.
 *   - robots: staging → every page `noindex, nofollow`, robots.txt `Disallow: /`, no sitemap, X-Robots-Tag in env.conf;
 *     production → the home is indexable and the sitemap lists /ar/, /en/ and every /p/:slug with hreflang pairs.
 *   - deployable builds (staging, production): no stub or localhost URL anywhere, no source maps, no staging ribbon in
 *     production, the build stamp present.
 *   - Apple Pay (review 04, W-7): /.well-known/apple-developer-merchantid-domain-association is present; while it is the
 *     repository's PLACEHOLDER a staging build (and a CI dry run of production) warns, a real production build fails —
 *     unless it is a showcase build (SW-5: no payments yet), which only warns.
 *   - showcase (SW-5, lib/showcase-checks.mjs): no cart/checkout/orders/login/account URL in the sitemap and the
 *     «التبرع الإلكتروني قريبًا» note on every prerendered page; a live build shows the note nowhere.
 *   - every file world-readable. Budgets are checked by check-bundle-budget.mjs (same postbuild chain).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BROWSER_DIR, CADDY_DIR, directives, htmlFiles, readCsp } from './lib/csp.mjs';
import { deployEnv } from './lib/envs.mjs';
import { applePayVerdict, showcaseProblems } from './lib/showcase-checks.mjs';

const env = deployEnv();
const problems = [];
if (!existsSync(BROWSER_DIR)) {
  console.error('check-deploy-output: dist/store-web/browser not found — build first.');
  process.exit(1);
}
const read = (f) => readFileSync(join(BROWSER_DIR, f), 'utf8');
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
const all = files(BROWSER_DIR);

const REQUIRED = ['index.html', '404.html', 'robots.txt', 'version.json', 'ar/index.html', 'en/index.html', 'ar/index.csr.html', 'en/index.csr.html'];
if (env.robots !== 'noindex') REQUIRED.push('sitemap.xml');
for (const f of REQUIRED) {
  const p = join(BROWSER_DIR, f);
  if (!existsSync(p)) problems.push(`${f} is missing`);
  else if (statSync(p).size === 0) problems.push(`${f} is empty`);
}
for (const f of ['index.html', '404.html'])
  if (existsSync(join(BROWSER_DIR, f)) && read(f) !== readFileSync(join('deploy', f), 'utf8')) problems.push(`${f} differs from deploy/${f}`);
const routes = existsSync('routes.txt') ? readFileSync('routes.txt', 'utf8').split('\n').filter(Boolean) : [];
for (const route of routes)
  if (!existsSync(join(BROWSER_DIR, route.replace(/^\//, ''), 'index.html'))) problems.push(`prerendered page missing for ${route}`);
const caddy = readFileSync('deploy/Caddyfile', 'utf8');
if (!caddy.includes('index.csr.html')) problems.push('deploy/Caddyfile lacks the client-shell (index.csr.html) fallback');
if (!/@html[\s\S]*no-cache/.test(caddy)) problems.push('deploy/Caddyfile lacks the no-cache rule for HTML');

// apiUrl compiled in, and allowed by the generated CSP.
const js = all.filter((f) => f.endsWith('.js'));
if (!js.some((f) => readFileSync(f, 'utf8').includes(env.apiUrl))) problems.push(`no JS bundle contains the runtime API URL ${env.apiUrl}`);
try {
  const d = directives(readCsp());
  const api = new URL(env.apiUrl).origin;
  if (!(d['connect-src'] ?? []).includes(api)) problems.push(`CSP connect-src does not allow ${api}`);
  if (env.errorReportUrl && !(d['connect-src'] ?? []).includes(new URL(env.errorReportUrl).origin))
    problems.push('CSP connect-src does not allow the error-report origin');
} catch (e) {
  problems.push(String(e.message ?? e));
}

// Canonical host and robots.
const home = read('ar/index.html');
const canonical = /<link rel="canonical" href="([^"]+)"/.exec(home)?.[1];
if (env.robots === 'noindex') {
  for (const f of htmlFiles(join(BROWSER_DIR, 'ar')).concat(htmlFiles(join(BROWSER_DIR, 'en')))) {
    const html = readFileSync(f, 'utf8');
    if (f.endsWith('index.csr.html')) continue;
    if (!/<meta name="robots" content="noindex, nofollow"/.test(html)) problems.push(`${relative(BROWSER_DIR, f)} is not noindex, nofollow`);
  }
  if (!/^Disallow: \/$/m.test(read('robots.txt'))) problems.push('robots.txt must be "Disallow: /" on staging');
  if (existsSync(join(BROWSER_DIR, 'sitemap.xml'))) problems.push('staging must not publish a sitemap');
  const envConf = existsSync(join(CADDY_DIR, 'env.conf')) ? readFileSync(join(CADDY_DIR, 'env.conf'), 'utf8') : '';
  if (!/X-Robots-Tag "noindex, nofollow"/.test(envConf)) problems.push('env.conf lacks X-Robots-Tag: noindex, nofollow');
} else {
  if (/<meta name="robots" content="noindex/.test(home)) problems.push('the home page is noindex');
  if (canonical !== `${env.site}/ar/`) problems.push(`canonical of /ar/ is ${canonical}, expected ${env.site}/ar/`);
  if (existsSync(join(BROWSER_DIR, 'sitemap.xml'))) {
    const sitemap = read('sitemap.xml');
    const want = routes.length ? routes : ['/ar/', '/en/'];
    for (const r of want) if (!sitemap.includes(`<loc>${env.site}${r}</loc>`)) problems.push(`sitemap lacks ${r}`);
    if (!sitemap.includes('hreflang="en"') || !sitemap.includes('hreflang="x-default"')) problems.push('sitemap lacks hreflang pairs');
    if (!read('robots.txt').includes(`Sitemap: ${env.site}/sitemap.xml`)) problems.push('robots.txt does not point at the sitemap');
  }
}
for (const f of [...htmlFiles(BROWSER_DIR)].filter((x) => /\/(ar|en)\//.test(x) && !x.endsWith('index.csr.html'))) {
  const h = /<link rel="canonical" href="([^"]+)"/.exec(readFileSync(f, 'utf8'))?.[1];
  if (h && !h.startsWith(`${env.site}/`)) problems.push(`${relative(BROWSER_DIR, f)}: canonical on ${h}, not ${env.site}`);
}

// Build stamp.
try {
  const v = JSON.parse(read('version.json'));
  if (!v.version || !v.commit || v.env !== env.name) problems.push(`version.json is incomplete or for another env (${JSON.stringify(v)})`);
  if (!home.includes('<meta name="build" content="')) problems.push('the home page has no <meta name="build">');
  if (/token|secret|password/i.test(JSON.stringify(v))) problems.push('version.json must carry no secret');
} catch {
  problems.push('version.json is not valid JSON');
}

// Deployable builds: nothing local, no maps, no ribbon in production.
// A CI dry run prerenders a deployable config from the stub (PRERENDER_API_URL on localhost): its DATA (image URLs in
// the prerendered HTML) may then point at the stub — tolerated with a warning; compiled code never may. The data sits
// in attributes (`src="http://localhost:3000/…"`) AND in the hydration transfer state, where Angular escapes "/"
// (`http://localhost:3000…`), so the stub's host:port is matched in every serialisation; any OTHER local
// address (e.g. :5080) still fails.
const dryRunOrigin = process.env.PRERENDER_API_URL && /localhost|127\.0\.0\.1/.test(process.env.PRERENDER_API_URL)
  ? new URL(process.env.PRERENDER_API_URL).origin
  : null;
const dryRunHost = dryRunOrigin ? new URL(dryRunOrigin).host : null;
let dryRunHits = 0;
if (env.deployable) {
  const text = all.filter((f) => /\.(js|html|css|json|txt|xml)$/.test(f));
  for (const f of text) {
    let s = readFileSync(f, 'utf8');
    if (dryRunHost && f.endsWith('.html') && s.includes(dryRunHost)) {
      dryRunHits += 1;
      s = s.replaceAll(dryRunHost, '');
    }
    if (/localhost|127\.0\.0\.1/.test(s)) problems.push(`${relative(BROWSER_DIR, f)} mentions localhost (stub or dev API)`);
    if (/sourceMappingURL=/.test(s)) problems.push(`${relative(BROWSER_DIR, f)} references a source map`);
  }
  for (const f of all) if (f.endsWith('.map')) problems.push(`${relative(BROWSER_DIR, f)}: source maps must not be served`);
  if (env.name === 'production' && js.some((f) => readFileSync(f, 'utf8').includes('نسخة تجريبية')))
    problems.push('the staging ribbon is in the production bundle');
}
if (env.name === 'staging' && !js.some((f) => readFileSync(f, 'utf8').includes('نسخة تجريبية')))
  problems.push('the staging build lacks the staging ribbon');

const check = (p) => {
  const s = statSync(p);
  const need = s.isDirectory() ? 0o005 : 0o004;
  if ((s.mode & need) !== need) problems.push(`${relative(BROWSER_DIR, p) || '(root)'} mode ${(s.mode & 0o777).toString(8)}`);
  if (s.isDirectory()) for (const n of readdirSync(p)) check(join(p, n));
};
check(BROWSER_DIR);

const APPLE_PAY = '.well-known/apple-developer-merchantid-domain-association';
let applePayWarning = '';
if (!existsSync(join(BROWSER_DIR, APPLE_PAY)) || statSync(join(BROWSER_DIR, APPLE_PAY)).size === 0) problems.push(`${APPLE_PAY} is missing`);
else {
  const verdict = applePayVerdict({
    envName: env.name,
    deployable: env.deployable,
    dryRun: !!dryRunOrigin,
    placeholder: read(APPLE_PAY).startsWith('PLACEHOLDER'),
    showcase: env.showcase,
  });
  if (verdict.problem) problems.push(`${APPLE_PAY}: ${verdict.problem}`);
  if (verdict.warning) applePayWarning = `${APPLE_PAY}: ${verdict.warning}`;
}

// SW-5: showcase builds never lead a donor to a payment; live builds never say "soon".
problems.push(
  ...showcaseProblems({
    showcase: env.showcase,
    sitemap: existsSync(join(BROWSER_DIR, 'sitemap.xml')) ? read('sitemap.xml') : null,
    pages: routes
      .map((r) => `${r.replace(/^\/+|\/+$/g, '')}/index.html`)
      .filter((f) => existsSync(join(BROWSER_DIR, f)))
      .map((f) => ({ path: f, html: read(f) })),
  }),
);

if (applePayWarning) console.warn(`check-deploy-output: WARNING — ${applePayWarning}.`);
if (dryRunHits)
  console.warn(`check-deploy-output: WARNING — ${dryRunHits} prerendered page(s) carry data from ${dryRunOrigin} (dry run only; never deploy this output).`);
if (problems.length) {
  console.error(`check-deploy-output: [${env.name}] not safe to publish:\n  - ${problems.slice(0, 30).join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `check-deploy-output: [${env.name}${env.showcase ? ', showcase' : ''}] ${REQUIRED.length} required files, ${routes.length} prerendered routes; API ${env.apiUrl} compiled in and allowed by the CSP; canonical ${env.site}; robots ${env.robots}${env.deployable ? '; no localhost, no source maps' : ''}.`,
);
