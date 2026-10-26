#!/usr/bin/env node
/**
 * Records the stub API's fixtures from the REAL local R5 store API (Development seed: 3 categories, 6 projects with
 * options), so the stub (CI) serves the same shapes the app gets in production. Re-run when the API moves AND the
 * OpenAPI snapshot changed (U-1):  node scripts/stub-capture.mjs
 * Public GET routes only (the listing in each sort order, every project, the config); writes scripts/stub-data/public.json
 * ({ "<path?query>": <body> }) plus `meta.apiCommit`, and scripts/stub-data/files.json (the images, base64).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = (process.env.STORE_API_URL ?? 'http://localhost:5080/v1').replace(/\/$/, '');
const apiDir = process.env.STORE_API_DIR ?? resolve('..', 'ta3lom_store_api');
const get = async (p) => {
  const r = await fetch(API + p, { headers: { 'Accept-Language': 'ar' } });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const out = {};
const record = async (p) => (out[p] = await get(p));

await record('/catalog/home');
await record('/catalog/categories');
await record('/catalog/config');
const { slugs } = await record('/catalog/projects?fields=slug');
// U-2: the default order (sort, published_at DESC, id) and the other two sorts, as the API returns them.
for (const sort of ['', '&sort=newest', '&sort=title']) await record(`/catalog/projects?pageSize=100${sort}`);
for (const slug of slugs) await record(`/catalog/projects/${slug}`);
// The public images the fixtures point at (served by the stub under /files/public/…, base64).
const files = {};
for (const url of new Set(JSON.stringify(out).match(/https?:\/\/[^"]+\/files\/public\/[^"]+/g) ?? [])) {
  const r = await fetch(url);
  if (r.ok) files[new URL(url).pathname] = Buffer.from(await r.arrayBuffer()).toString('base64');
}
writeFileSync('scripts/stub-data/files.json', JSON.stringify(files, null, 1) + '\n');
let apiCommit = 'unknown';
try {
  apiCommit = execFileSync('git', ['-C', apiDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  /* not a checkout */
}
writeFileSync('scripts/stub-data/public.json', JSON.stringify({ meta: { apiCommit }, ...out }, null, 1) + '\n');
console.log(`stub-capture: ${Object.keys(out).length} responses, ${Object.keys(files).length} images recorded (API ${apiCommit})`);
