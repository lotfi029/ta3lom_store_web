#!/usr/bin/env node
/**
 * Container gate (owner brief P2, H-2, H-3, M-8): runs the built image and fails on any mismatch.
 *   node scripts/check-container.mjs <image> [--env ci|staging|production] [--port 8099] [--keep]
 * Checks, against a container started like production (read-only root, tmpfs /tmp, all capabilities dropped):
 *   - runs as a non-root user; /healthz 200 "ok", no-store; / → 302 /ar/
 *   - headers on /ar/: the CSP equals the image's /etc/caddy/csp.conf (generated at build), frame-ancestors 'none',
 *     nosniff, Referrer-Policy, Permissions-Policy, COOP, no Server header; HSTS ABSENT with TLS_MODE=edge (default)
 *     and PRESENT with TLS_MODE=direct (a second container); X-Robots-Tag noindex on staging only
 *   - /ar/orders/<ref> → the client shell with Referrer-Policy no-referrer
 *   - client-only routes (cart, checkout, login, orders, account/**, admin/**, an unknown /p/<slug>) → 200 + client shell
 *   - unknown paths → 404 (locale: the client shell; root: the static 404.html)
 *   - cache: fingerprinted JS/CSS/fonts `immutable` for a year; HTML and index.csr.html `no-cache`; version.json no-store
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
const DIRECT = 'store-web-check-direct';
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
  expect(!h('strict-transport-security'), 'HSTS must not be sent with TLS_MODE=edge (owner M-8)');
  expect(h('cache-control') === 'no-cache', `/ar/ Cache-Control is ${h('cache-control')}, expected no-cache`);
  expect(html.includes('<meta name="build"'), '/ar/ lacks the build stamp');
  if (ENV === 'staging') expect(h('x-robots-tag') === 'noindex, nofollow', 'staging must send X-Robots-Tag: noindex, nofollow');
  else expect(!h('x-robots-tag'), `X-Robots-Tag must not be sent on ${ENV}`);

  // Compression
  r = await get(PORT, '/ar/', { 'Accept-Encoding': 'zstd, gzip' });
  expect(['gzip', 'zstd'].includes(r.headers.get('content-encoding') ?? ''), 'HTML is not compressed (zstd/gzip)');

  // Cache of fingerprinted assets
  const asset = /(?:src|href)="((?:main|chunk|polyfills|styles)-[A-Z0-9]{8}\.(?:js|css))"/.exec(html)?.[1];
  expect(!!asset, 'no fingerprinted asset referenced by /ar/');
  if (asset) {
    r = await get(PORT, `/ar/${asset}`);
    expect(r.status === 200 && r.headers.get('cache-control') === 'public, max-age=31536000, immutable', `/ar/${asset} is not immutable (${r.headers.get('cache-control')})`);
  }

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
  r = await get(PORT, '/no-such-file.txt');
  expect(r.status === 404 && (await r.text()).includes('الصفحة غير موجودة'), `/no-such-file.txt → ${r.status}, expected the static 404 page`);

  // robots.txt
  r = await get(PORT, '/robots.txt');
  const robots = await r.text();
  if (ENV === 'staging') expect(/^Disallow: \/$/m.test(robots), 'staging robots.txt must Disallow: /');
  else expect(/Sitemap: https:\/\//.test(robots), 'robots.txt must point at the sitemap');

  // TLS_MODE=direct sends HSTS (owner M-8)
  start(DIRECT, PORT + 1, ['TLS_MODE=direct']);
  if (await ready(PORT + 1)) {
    r = await get(PORT + 1, '/ar/');
    expect(/max-age=31536000/.test(r.headers.get('strict-transport-security') ?? ''), 'TLS_MODE=direct must send HSTS');
  } else problems.push('the TLS_MODE=direct container did not become healthy');
} catch (e) {
  problems.push(String(e.message ?? e));
} finally {
  try {
    docker('rm', '-f', DIRECT);
  } catch {
    /* gone */
  }
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
console.log(`check-container: ${image} [${ENV}] — headers, CSP (generated), fallbacks, 404s, cache, compression, healthz, robots, non-root: OK${KEEP ? ` (left running on :${PORT})` : ''}`);
