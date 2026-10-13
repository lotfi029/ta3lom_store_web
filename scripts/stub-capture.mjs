#!/usr/bin/env node
/**
 * Records the stub API's fixtures from the REAL local store API (seeded by api-seed-e2e.sh), so the stub (CI) serves
 * the same shapes the app gets in production. Re-run after the contract changes:  node scripts/stub-capture.mjs
 * Public GET routes only; writes scripts/stub-data/public.json  ({ "<path?query>": <body> }).
 */
import { writeFileSync } from 'node:fs';

const API = (process.env.STORE_API_URL ?? 'http://localhost:5080/v1').replace(/\/$/, '');
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
const slugs = await get('/catalog/products?fields=slug&pageSize=100&page=1');
out['/catalog/products?fields=slug&pageSize=100&page=1'] = slugs;
for (const type of ['', 'course', 'book']) await record(`/catalog/products?pageSize=100${type ? `&type=${type}` : ''}`);
for (const { slug } of slugs.items) await record(`/catalog/products/${slug}`);
await record(`/catalog/live?slugs=${slugs.items.map((i) => i.slug).join(',')}`);
writeFileSync('scripts/stub-data/public.json', JSON.stringify(out, null, 1));
console.log(`stub-capture: ${Object.keys(out).length} responses recorded`);
