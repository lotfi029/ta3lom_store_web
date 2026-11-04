#!/usr/bin/env node
/**
 * Container gate (owner brief P2, H-2, H-3, M-8): runs the built image and fails on any mismatch.
 *   node scripts/check-container.mjs <image> [--env ci|staging|production] [--port 8099] [--keep]
 * Checks, against a container started like production (read-only root, tmpfs /tmp, all capabilities dropped):
 *   - runs as a non-root user; /healthz 200 "ok", no-store; / → 302 /ar/
 *   - headers on /ar/: the CSP equals the image's /etc/caddy/csp.conf (generated at build), frame-ancestors 'none',
 *     nosniff, Referrer-Policy, Permissions-Policy, COOP, no Server header; HSTS never (the edge sends it — TLS_MODE=direct
 *     was removed, review 06 L-6); X-Robots-Tag noindex on staging only
 *   - prerendered pages WITHOUT a trailing slash (/ar, /ar/p/<slug>) are no-cache (review 06 D-3)
 *   - 404s keep the security headers and send no Server header (review 06 L-1)
 *   - /ar/orders/<ref> → the client shell with Referrer-Policy no-referrer
 *   - client-only routes (cart, checkout, login, orders, account/**, admin/**, an unknown /p/<slug>) → 200 + client shell
 *   - unknown paths → 404 (locale: the client shell; root: the static 404.html)
 *   - cache: fingerprinted JS/CSS/fonts `immutable` for a year — incl. a LAZY chunk named by main.js (review 04 S-7: mixed
 *     case, `_`, `-`); HTML and index.csr.html `no-cache`; version.json no-store
 *   - /.well-known/apple-developer-merchantid-domain-association: 200, text/plain, no-cache (Apple Pay on Moyasar)
 *   - gzip/zstd compression on HTML; /version.json carries the commit; robots.txt per environment
 * With --keep the main container is left running (LHCI runs against it next, H-2); stop it with `docker rm -f`.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const image = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a) && !['ci', 'staging', 'production'].includes(a));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ENV = opt('env', 'ci');
const PORT = Number(opt('port', '8099'));
const KEEP = args.includes('--keep');
if (!image) {
  console.error('usage: node scripts/check-container.mjs <image> [--env ci|staging|production] [--port 8099] [--keep]');
  process.exit(2);
}

const docker = (...a) => execFileSync('docker', a, { encoding: 'utf8' }).trim();
const problems = [];
const expect = (ok, msg) => {
  if (!ok) problems.push(msg);
};

function start(name, port, extraEnv = []) {
  try {
    docker('rm', '-f', name);
  } catch {
    /* none */
  }
  docker(
    'run', '-d', '--name', name, '-p', `127.0.0.1:${port}:8080`,
    '--read-only', '--tmpfs', '/tmp:size=16m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    ...extraEnv.flatMap((e) => ['-e', e]),
    image,
  );
}

async function ready(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const get = (port, path, headers = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual', headers: { 'Accept-Encoding': 'identity', ...headers } });

const MAIN = 'store-web-check';
start(MAIN, PORT);
try {
  if (!(await ready(PORT))) {
    console.error(docker('logs', MAIN));
    throw new Error('container did not become healthy on /healthz');
  }
  const user = docker('inspect', '-f', '{{.Config.User}}', image);
  expect(user && user !== 'root' && user !== '0', `image runs as "${user || 'root'}", expected a non-root user`);
  const csp = /Content-Security-Policy\s+"([^"]+)"/.exec(docker('exec', MAIN, 'cat', '/etc/caddy/csp.conf'))?.[1];
  expect(!!csp, 'the image has no /etc/caddy/csp.conf');

  // Health, redirect, version
  let r = await get(PORT, '/healthz');
  expect(r.status === 200 && (await r.text()).trim() === 'ok', '/healthz must answer 200 "ok"');
  expect(r.headers.get('cache-control') === 'no-store', '/healthz must be no-store');
  r = await get(PORT, '/');
  expect(r.status === 302 && r.headers.get('location') === '/ar/', `/ must 302 → /ar/ (got ${r.status} ${r.headers.get('location')})`);
  r = await get(PORT, '/version.json');
  const version = await r.json().catch(() => ({}));
  expect(r.status === 200 && !!version.commit && version.env === ENV, `/version.json must carry the commit and env ${ENV}`);
  expect(r.headers.get('cache-control') === 'no-store', '/version.json must be no-store');

  // Headers on a page
  r = await get(PORT, '/ar/');
  const html = await r.text();
  const h = (n) => r.headers.get(n);
  expect(r.status === 200, `/ar/ answered ${r.status}`);
  expect(h('content-security-policy') === csp, 'the served CSP differs from /etc/caddy/csp.conf');
  expect(/frame-ancestors 'none'/.test(h('content-security-policy') ?? ''), "CSP frame-ancestors must be 'none'");
  expect(!/'unsafe-inline'[^;]*;?/.test(/script-src[^;]*/.exec(h('content-security-policy') ?? '')?.[0] ?? ''), "script-src must not allow 'unsafe-inline'");
  expect(h('x-content-type-options') === 'nosniff', 'X-Content-Type-Options nosniff missing');
  expect(h('referrer-policy') === 'strict-origin-when-cross-origin', `Referrer-Policy is ${h('referrer-policy')}`);
  expect(/camera=\(\)/.test(h('permissions-policy') ?? ''), 'Permissions-Policy missing');
  expect(h('cross-origin-opener-policy') === 'same-origin', 'COOP missing');
  expect(!h('server'), `Server header leaks: ${h('server')}`);
  expect(!h('strict-transport-security'), 'HSTS must not be sent by the image — the edge sends it (owner M-8, L-6)');
  expect(h('cache-control') === 'no-cache', `/ar/ Cache-Control is ${h('cache-control')}, expected no-cache`);
  expect(html.includes('<meta name="build"'), '/ar/ lacks the build stamp');
  if (ENV === 'staging') expect(h('x-robots-tag') === 'noindex, nofollow', 'staging must send X-Robots-Tag: noindex, nofollow');
  else expect(!h('x-robots-tag'), `X-Robots-Tag must not be sent on ${ENV}`);

  // D-3: canonical/sitemap URLs without a trailing slash must revalidate too
  r = await get(PORT, '/ar');
  expect([200, 301, 302, 308].includes(r.status), `/ar answered ${r.status}`);
  expect(r.headers.get('cache-control') === 'no-cache', `/ar Cache-Control is ${r.headers.get('cache-control')}, expected no-cache`);
  const slug = /href="\/ar\/p\/([a-z0-9-]+)"/.exec(html)?.[1];
  expect(!!slug, '/ar/ links no prerendered project page');
  if (slug) {
    r = await get(PORT, `/ar/p/${slug}`);
    expect(r.status === 200, `/ar/p/${slug} answered ${r.status}`);
    expect(r.headers.get('cache-control') === 'no-cache', `/ar/p/${slug} Cache-Control is ${r.headers.get('cache-control')}, expected no-cache`);
  }
  r = await get(PORT, '/favicon.ico');
  if (r.status === 200) expect(r.headers.get('cache-control') === 'no-cache', `/favicon.ico Cache-Control is ${r.headers.get('cache-control')}`);

  // Compression
  r = await get(PORT, '/ar/', { 'Accept-Encoding': 'zstd, gzip' });
  expect(['gzip', 'zstd'].includes(r.headers.get('content-encoding') ?? ''), 'HTML is not compressed (zstd/gzip)');

  // Cache of fingerprinted assets
  const HASH = '[A-Za-z0-9_-]{8}';
  const asset = new RegExp(`(?:src|href)="((?:main|chunk|polyfills|styles)-${HASH}\\.(?:js|css))"`).exec(html)?.[1];
  expect(!!asset, 'no fingerprinted asset referenced by /ar/');
  const immutable = 'public, max-age=31536000, immutable';
  if (asset) {
    r = await get(PORT, `/ar/${asset}`);
    expect(r.status === 200 && r.headers.get('cache-control') === immutable, `/ar/${asset} is not immutable (${r.headers.get('cache-control')})`);
  }
  // S-7: a lazy chunk (not in the HTML: main.js imports it) must be immutable too, whatever the case of its hash.
  const main = /src="(main-[A-Za-z0-9_-]{8}\.js)"/.exec(html)?.[1];
  const lazy = main ? new RegExp(`chunk-${HASH}\\.js`).exec(await (await get(PORT, `/ar/${main}`)).text())?.[0] : undefined;
  expect(!!lazy, 'main.js names no lazy chunk');
  if (lazy) {
    r = await get(PORT, `/ar/${lazy}`);
    expect(r.status === 200 && r.headers.get('cache-control') === immutable, `lazy chunk /ar/${lazy} is not immutable (${r.headers.get('cache-control')})`);
  }

  // Apple Pay domain association (served at the root, plain text, revalidated: the owner replaces the placeholder).
  r = await get(PORT, '/.well-known/apple-developer-merchantid-domain-association');
  expect(r.status === 200, `/.well-known/apple-developer-merchantid-domain-association answered ${r.status}`);
  expect((r.headers.get('content-type') ?? '').startsWith('text/plain'), `the Apple Pay file is served as ${r.headers.get('content-type')}, expected text/plain`);
  expect(r.headers.get('cache-control') === 'no-cache', `the Apple Pay file Cache-Control is ${r.headers.get('cache-control')}, expected no-cache`);

  // Client-only routes → the client shell
  const shells = {
    ar: await (await get(PORT, '/ar/index.csr.html')).text(),
    en: await (await get(PORT, '/en/index.csr.html')).text(),
  };
  for (const p of ['/ar/cart', '/en/checkout', '/ar/login', '/ar/account/donations', '/en/admin/projects', '/ar/p/not-prerendered-slug', '/ar/orders/T3-26-000001']) {
    r = await get(PORT, p);
    const body = await r.text();
    expect(r.status === 200 && body === shells[p.slice(1, 3)], `${p} → ${r.status}, expected the client shell`);
    expect(body.includes('<ta-root'), `${p} is not an app shell`);
    expect(r.headers.get('cache-control') === 'no-cache', `${p} must be no-cache`);
    if (p.includes('/orders/')) expect(r.headers.get('referrer-policy') === 'no-referrer', `${p} must send Referrer-Policy no-referrer`);
  }

  // 404s
  r = await get(PORT, '/ar/no-such-page');
  expect(r.status === 404 && (await r.text()).includes('<ta-root'), `/ar/no-such-page → ${r.status}, expected 404 with the app shell`);
  for (const [n, v] of [['x-content-type-options', 'nosniff'], ['referrer-policy', 'strict-origin-when-cross-origin'], ['cross-origin-opener-policy', 'same-origin']])
    expect(r.headers.get(n) === v, `404 ${n} is ${r.headers.get(n)}, expected ${v} (L-1)`);
  expect(/camera=\(\)/.test(r.headers.get('permissions-policy') ?? ''), '404 Permissions-Policy missing (L-1)');
  expect(r.headers.get('content-security-policy') === csp, '404 CSP differs from /etc/caddy/csp.conf (L-1)');
  expect(!r.headers.get('server'), `404 Server header leaks: ${r.headers.get('server')} (L-1)`);
  r = await get(PORT, '/no-such-file.txt');
  expect(r.status === 404 && (await r.text()).includes('الصفحة غير موجودة'), `/no-such-file.txt → ${r.status}, expected the static 404 page`);

  // robots.txt
  r = await get(PORT, '/robots.txt');
  const robots = await r.text();
  if (ENV === 'staging') expect(/^Disallow: \/$/m.test(robots), 'staging robots.txt must Disallow: /');
  else expect(/Sitemap: https:\/\//.test(robots), 'robots.txt must point at the sitemap');

  // The image's config label must match the environment it is checked for (review 06 D-2)
  const label = docker('inspect', '-f', '{{index .Config.Labels "sa.ta3lom.store-web.config"}}', image);
  expect(label === ENV, `image label sa.ta3lom.store-web.config is "${label}", expected "${ENV}"`);
} catch (e) {
  problems.push(String(e.message ?? e));
} finally {
  if (!KEEP)
    try {
      docker('rm', '-f', MAIN);
    } catch {
      /* gone */
    }
}

if (problems.length) {
  console.error(`check-container: ${image} [${ENV}] — ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check-container: ${image} [${ENV}] — headers (incl. 404s), CSP (generated), fallbacks, 404s, cache (incl. no-slash pages), compression, healthz, robots, non-root, config label: OK${KEEP ? ` (left running on :${PORT})` : ''}`);
