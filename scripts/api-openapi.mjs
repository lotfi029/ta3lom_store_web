#!/usr/bin/env node
/**
 * D-W1 / U-1: refreshes the web-owned OpenAPI snapshot from the real store API.
 *   1. starts the local API in Development (scripts/api-up.sh — idempotent)
 *   2. GET /openapi/v1.json (Development only)
 *   3. sorts every object's keys (arrays keep their order) so the file diff is stable
 *   4. records the API commit as info.x-api-commit and writes docs/openapi/store-api.v1.json
 * Then run `npm run types:gen`. CI never runs this; it runs `types:check` against the committed snapshot.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = process.env.STORE_API_DIR ?? resolve(root, '..', 'ta3lom_store_api');
const origin = process.env.STORE_API_ORIGIN ?? 'http://localhost:5080';
const out = join(root, 'docs/openapi/store-api.v1.json');

if (process.env.SKIP_API_UP !== '1') execFileSync('bash', [join(root, 'scripts/api-up.sh')], { stdio: 'inherit' });

const res = await fetch(`${origin}/openapi/v1.json`);
if (!res.ok) {
  console.error(`api-openapi: GET ${origin}/openapi/v1.json → ${res.status} (is the API running in Development?)`);
  process.exit(1);
}
const doc = await res.json();
const commit = execFileSync('git', ['-C', apiDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
doc.info = { ...doc.info, 'x-api-commit': commit };

const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;

writeFileSync(out, JSON.stringify(sortKeys(doc), null, 2) + '\n');
console.log(`api-openapi: wrote docs/openapi/store-api.v1.json (API ${commit.slice(0, 7)}, ${Object.keys(doc.paths ?? {}).length} paths)`);
