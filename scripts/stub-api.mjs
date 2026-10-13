#!/usr/bin/env node
/**
 * Stub store API on :3000 (`npm run stub-api`) for CI, where the real API repo isn't available (plan §4, DECISIONS: CI).
 * Public GETs replay fixtures recorded from the real API (scripts/stub-data/public.json, scripts/stub-capture.mjs):
 * exact path+query first, then the path with filters applied in memory (type, category, q, sort, page, pageSize).
 * Cart and auth answer as an empty guest / signed-out visitor. Anything else: 404 problem.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.STUB_PORT ?? 3000);
const data = JSON.parse(readFileSync(new URL('./stub-data/public.json', import.meta.url), 'utf8'));
const problem = (status, code) => ({ type: `https://store-api.ta3lom.sa/problems/${code}`, title: code, status, code });

function products(url) {
  const all = data['/catalog/products?pageSize=100'].items;
  const p = url.searchParams;
  let items = all.filter((i) => (!p.get('type') || i.type === p.get('type')) && (!p.get('category') || i.category?.slug === p.get('category')));
  const q = p.get('q')?.trim().toLowerCase();
  if (q) items = items.filter((i) => `${i.titleAr} ${i.titleEn} ${i.summaryAr} ${i.summaryEn}`.toLowerCase().includes(q));
  const sort = p.get('sort');
  if (sort === 'price_asc') items = [...items].sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'price_desc') items = [...items].sort((a, b) => Number(b.price) - Number(a.price));
  const page = Number(p.get('page') ?? 1);
  const pageSize = Number(p.get('pageSize') ?? 12);
  if (p.get('fields') === 'slug') items = items.map(({ type, slug }) => ({ type, slug, updatedAt: '2026-10-13T00:00:00Z' }));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

const emptyCart = { id: null, isGuest: true, lines: [], purchases: [], purchasesTotal: '0.00', shippingTotal: '0.00', grandTotal: '0.00', itemCount: 0, notices: [] };

function route(method, url) {
  const path = url.pathname.replace(/^\/v1/, '');
  const key = path + url.search;
  if (method === 'GET' && key in data) return [200, data[key]];
  if (method === 'GET' && path === '/catalog/products') return [200, products(url)];
  if (method === 'GET' && path in data) return [200, data[path]];
  if (method === 'GET' && path === '/catalog/live') {
    const slugs = (url.searchParams.get('slugs') ?? '').split(',');
    const recorded = Object.entries(data).find(([k]) => k.startsWith('/catalog/live?slugs='))?.[1] ?? { items: [] };
    return [200, { ...recorded, items: recorded.items.filter((i) => slugs.includes(i.slug)) }];
  }
  if (method === 'GET' && path.startsWith('/catalog/products/')) return [404, problem(404, 'catalog.product_not_found')];
  if (method === 'GET' && path === '/cart/summary') return [200, { itemCount: 0, grandTotal: '0.00' }];
  if (method === 'GET' && path === '/cart') return [200, emptyCart];
  if (method === 'POST' && (path === '/auth/refresh' || path === '/admin/auth/refresh')) return [401, problem(401, 'auth.refresh_invalid')];
  return [404, problem(404, 'http.not_found')];
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const origin = req.headers.origin;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' };
  if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE', 'Access-Control-Allow-Headers': 'content-type,authorization,idempotency-key,accept-language' });
    return res.end();
  }
  if (url.pathname === '/health/ready') {
    res.writeHead(200, headers);
    return res.end('{"status":"Healthy"}');
  }
  const [status, body] = route(req.method ?? 'GET', url);
  res.writeHead(status, status >= 400 ? { ...headers, 'Content-Type': 'application/problem+json' } : headers);
  res.end(JSON.stringify(body));
}).listen(PORT, () => console.log(`stub-api: listening on http://localhost:${PORT}/v1 (${Object.keys(data).length} recorded responses)`));
