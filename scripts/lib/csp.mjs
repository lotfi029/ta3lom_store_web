/**
 * Reads THE Content-Security-Policy from deploy/caddy-headers.conf (the one place it is written), for the build gate
 * (check-csp.mjs) and for the local static server (serve-dist, a11y, screenshots), which serve every page under it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROD_API = 'https://store-api.ta3lom.sa';

export function readCsp() {
  const conf = readFileSync(join(process.cwd(), 'deploy', 'caddy-headers.conf'), 'utf8');
  const m = conf.match(/Content-Security-Policy\s+"([^"]+)"/);
  if (!m) throw new Error('csp: no Content-Security-Policy in deploy/caddy-headers.conf');
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

/** The production policy with the API origin pointed at the local API (:5080) and the stub (:3000); no https upgrade. */
export function readLocalCsp() {
  return readCsp()
    .replaceAll(PROD_API, 'http://localhost:5080 http://localhost:3000')
    .replace(/;\s*upgrade-insecure-requests/, '');
}
