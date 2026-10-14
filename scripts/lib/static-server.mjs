/**
 * Static server over dist/store-web/browser for e2e, a11y and screenshots — behaves like the production Caddy site:
 *   - serves the web root (pages reference /ar/… and /en/… absolutely);
 *   - a path with no file falls back to that locale's client shell (index.csr.html) — the client-rendered routes
 *     (cart, checkout, account, admin, search, 404) and products published after the build (client fallback, plan §2.5);
 *   - `/` redirects to `/ar/`; every response carries the CSP passed in.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(root, urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(root, safe), join(root, safe, 'index.html'), join(root, `${safe}.html`)];
  for (const c of candidates)
    if (c.startsWith(root) && existsSync(c) && statSync(c).isFile())
      return { file: c, fallback: false };
  const locale = safe.split('/').filter(Boolean)[0];
  if (locale === 'ar' || locale === 'en') {
    for (const shell of ['index.csr.html', 'index.html']) {
      const f = join(root, locale, shell);
      if (existsSync(f)) return { file: f, fallback: true };
    }
  }
  return null;
}

export function startStaticServer(root, port, { csp } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(302, { Location: '/ar/' });
      return res.end();
    }
    const found = resolveFile(root, url.pathname);
    if (!found) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    const headers = {
      'Content-Type': TYPES[extname(found.file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    if (csp && headers['Content-Type'].startsWith('text/html'))
      headers['Content-Security-Policy'] = csp;
    res.writeHead(200, headers);
    createReadStream(found.file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
