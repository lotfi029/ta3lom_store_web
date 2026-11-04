/**
 * THE Content-Security-Policy is generated at build from the built pages (scripts/gen-csp.mjs, owner H-3) into
 * dist/store-web/caddy/csp.conf — the file the container serves. The build gate (check-csp.mjs), the container check
 * and the local static server (serve-dist, a11y, screenshots) all read it from there.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const BROWSER_DIR = join(process.cwd(), 'dist', 'store-web', 'browser');
export const CADDY_DIR = join(process.cwd(), 'dist', 'store-web', 'caddy');
export const CSP_FILE = join(CADDY_DIR, 'csp.conf');
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);

export function htmlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/** Every inline executable <script> of every built page → `'sha256-…'` token → first page + preview. */
export function inlineScriptHashes(root) {
  const used = new Map();
  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = m[1];
      if (/\ssrc\s*=/i.test(attrs)) continue;
      const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
      if (type && DATA_TYPES.has(type)) continue;
      const token = `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
      if (!used.has(token))
        used.set(token, { page: relative(root, file), preview: m[2].slice(0, 70).replace(/\s+/g, ' ') });
    }
  }
  return used;
}

export function readCsp() {
  if (!existsSync(CSP_FILE)) throw new Error('csp: dist/store-web/caddy/csp.conf missing — build first (gen-csp.mjs)');
  const m = readFileSync(CSP_FILE, 'utf8').match(/Content-Security-Policy\s+"([^"]+)"/);
  if (!m) throw new Error('csp: no Content-Security-Policy in dist/store-web/caddy/csp.conf');
  return m[1];
}

export function directives(csp) {
  return Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

/** The build's policy for local http serving (serve-dist): no https upgrade. */
export function readLocalCsp() {
  return readCsp().replace(/;\s*upgrade-insecure-requests/, '');
}
