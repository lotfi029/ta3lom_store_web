#!/usr/bin/env node
/**
 * Stub store API on :3000 (`npm run stub-api`) for CI, where the real API repo isn't available (DECISIONS: CI).
 *
 * Reads replay fixtures recorded from the real R5 API (scripts/stub-data/public.json, scripts/stub-capture.mjs): exact
 * path+query first, then the listing filtered in memory (category, q, page, pageSize) KEEPING the API's order for each
 * sort (U-2: the client never re-sorts). Image URLs are rewritten to this origin and served from stub-data/files.json.
 *
 * Writes are deterministic and in memory (one guest/donor at a time, the e2e suite runs with one worker):
 *   cart lines (three shapes, limits from the recorded config), OTP sign-in (any 6 digits; the "SMS" is at
 *   GET /dev/sms), refresh via a cookie, quote, checkout with Idempotency-Key replay, order status, /me, donations,
 *   export and delete. `POST /__reset` clears the state (each e2e spec calls it, so specs never see each other's data).
 * Admin: refresh answers 401 (the admin login page renders; admin journeys run against the real API only).
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.STUB_PORT ?? 3000);
const ORIGIN = `http://localhost:${PORT}`;
const raw = readFileSync(new URL('./stub-data/public.json', import.meta.url), 'utf8').replace(
  /https?:\/\/[^"/]+(\/files\/public\/)/g,
  `${ORIGIN}$1`,
);
const data = JSON.parse(raw);
const files = JSON.parse(readFileSync(new URL('./stub-data/files.json', import.meta.url), 'utf8'));
const config = data['/catalog/config'];
const projects = Object.fromEntries(
  Object.entries(data)
    .filter(([k]) => k.startsWith('/catalog/projects/'))
    .map(([, v]) => [v.id, v]),
);
const categories = Object.fromEntries(data['/catalog/categories'].map((c) => [c.id, c]));

const problem = (status, code, extra = {}) => ({
  type: `https://store-api.ta3lom.sa/problems/${code}`,
  title: code,
  status,
  code,
  traceId: '00000000000000000000000000000000',
  ...extra,
});

// ── money in halalas (never floats) ───────────────────────────────────────────────────────────────────────
const AR_DIGITS = /[٠-٩۰-۹٫]/g;
const toWestern = (s) =>
  s.replace(AR_DIGITS, (d) => (d === '٫' ? '.' : String((d.charCodeAt(0) - 0x0660) % 0x90)));
function halalas(v) {
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(toWestern(String(v ?? '')).trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : null;
}
const money = (h) => `${Math.trunc(h / 100)}.${String(h % 100).padStart(2, '0')}`;

// ── state ─────────────────────────────────────────────────────────────────────────────────────────────────
let state;
function reset() {
  state = { cart: [], signedIn: false, sms: [], me: null, orders: [], idem: new Map(), seq: 0, lineSeq: 0 };
}
reset();
const ME = (mobile) => ({
  id: '01a17400-0000-7000-8000-000000000001',
  mobile,
  fullName: null,
  email: null,
  locale: 'ar',
  marketingOptIn: false,
  status: 'active',
  pdplConsentAt: '2026-10-25T00:00:00+00:00',
  createdAt: '2026-10-25T00:00:00+00:00',
});

function cartView() {
  const lines = state.cart.map((l) => ({ ...l, amount: money(halalas(l.unitAmount) * l.quantity) }));
  const total = lines.reduce((t, l) => t + halalas(l.amount), 0);
  return { lines, lineCount: lines.length, totalAmount: money(total), problems: [] };
}

function addLine(body) {
  const { projectId, optionId, categoryId, amount } = body ?? {};
  const quantity = body?.quantity ?? 1;
  const max = halalas(config.maxLineAmount);
  if (state.cart.length >= Number(config.cartMaxLines)) return [422, problem(422, 'cart.too_many_lines', { max: Number(config.cartMaxLines) })];
  const id = `01a17400-0000-7000-8000-${String(++state.lineSeq).padStart(12, '0')}`;
  if (projectId && optionId) {
    const p = projects[projectId];
    const o = p?.options.find((x) => x.id === optionId);
    if (!p) return [422, problem(422, 'cart.target_unavailable')];
    if (!o) return [422, problem(422, 'cart.option_unavailable')];
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(config.maxQuantity))
      return [422, problem(422, 'cart.quantity_limit', { max: Number(config.maxQuantity) })];
    const same = state.cart.find((l) => l.optionId === optionId);
    if (same) same.quantity = Math.min(Number(config.maxQuantity), same.quantity + quantity);
    else
      state.cart.push({
        id,
        targetKind: 'project',
        projectId,
        projectSlug: p.slug,
        categoryId: null,
        categorySlug: p.category.slug,
        optionId,
        titleAr: p.titleAr,
        titleEn: p.titleEn,
        optionLabelAr: o.labelAr,
        optionLabelEn: o.labelEn,
        quantity,
        unitAmount: o.amount,
        problems: [],
      });
    return [200, cartView()];
  }
  const h = halalas(amount);
  if (h === null || h === 0) return [400, problem(400, 'validation.failed', { errors: { amount: ['Invalid amount.'] } })];
  const target = projectId ? projects[projectId] : categoryId ? categories[categoryId] : null;
  if (!target || (categoryId && !target.acceptsGeneralGifts)) return [422, problem(422, 'cart.target_unavailable')];
  if (projectId && !target.allowOpenAmount) return [422, problem(422, 'cart.open_amount_not_allowed')];
  const min = halalas(projectId ? target.minAmount : config.minGiftAmount);
  if (h < min) return [422, problem(422, 'cart.amount_below_minimum', { min: money(min) })];
  if (h > max) return [422, problem(422, 'cart.amount_above_maximum', { max: config.maxLineAmount })];
  state.cart.push({
    id,
    targetKind: projectId ? 'project' : 'category',
    projectId: projectId ?? null,
    projectSlug: projectId ? target.slug : null,
    categoryId: categoryId ?? null,
    categorySlug: categoryId ? target.slug : target.category.slug,
    optionId: null,
    titleAr: projectId ? target.titleAr : target.nameAr,
    titleEn: projectId ? target.titleEn : target.nameEn,
    optionLabelAr: null,
    optionLabelEn: null,
    quantity: 1,
    unitAmount: money(h),
    problems: [],
  });
  return [200, cartView()];
}

function patchLine(id, body) {
  const line = state.cart.find((l) => l.id === id);
  if (!line) return [404, problem(404, 'cart.line_not_found')];
  if (body?.quantity !== undefined && body?.quantity !== null) {
    if (body.quantity < 1 || body.quantity > Number(config.maxQuantity))
      return [422, problem(422, 'cart.quantity_limit', { max: Number(config.maxQuantity) })];
    line.quantity = body.quantity;
  } else {
    const h = halalas(body?.amount);
    const min = halalas(line.categoryId ? config.minGiftAmount : projects[line.projectId]?.minAmount ?? config.minGiftAmount);
    if (h === null || h === 0) return [400, problem(400, 'validation.failed', { errors: { amount: ['Invalid amount.'] } })];
    if (h < min) return [422, problem(422, 'cart.amount_below_minimum', { min: money(min) })];
    line.unitAmount = money(h);
  }
  return [200, cartView()];
}

function checkout(req, body) {
  const key = req.headers['idempotency-key'];
  if (!key) return [400, problem(400, 'idempotency.key_required')];
  const canon = JSON.stringify(body ?? {});
  const prior = state.idem.get(key);
  if (prior) return prior.body === canon ? [201, prior.response, { 'Idempotent-Replayed': 'true' }] : [422, problem(422, 'idempotency.key_reused')];
  const fullName = body?.fullName?.trim() || state.me.fullName;
  const email = body?.email?.trim() || state.me.email;
  if (!fullName || !email) return [422, problem(422, 'checkout.contact_required')];
  if (state.cart.length === 0) return [409, problem(409, 'checkout.cart_empty')];
  Object.assign(state.me, { fullName, email, locale: body?.locale ?? state.me.locale });
  const view = cartView();
  const reference = `T3-26-${String(++state.seq).padStart(6, '0')}`;
  const order = {
    reference,
    status: 'pending_payment',
    totalAmount: view.totalAmount,
    lineCount: view.lineCount,
    createdAt: '2026-10-25T12:00:00+00:00',
    paymentDueAt: '2026-10-25T13:00:00+00:00',
    cancelledAt: null,
    donorName: fullName,
    donorEmail: email,
    lines: view.lines.map((l, i) => ({
      lineNo: i + 1,
      targetKind: l.targetKind,
      projectId: l.projectId,
      categoryId: l.categoryId,
      titleAr: l.titleAr,
      titleEn: l.titleEn,
      optionLabelAr: l.optionLabelAr,
      optionLabelEn: l.optionLabelEn,
      quantity: l.quantity,
      unitAmount: l.unitAmount,
      amount: l.amount,
    })),
  };
  state.orders.unshift(order);
  state.cart = [];
  const response = { reference, status: 'pending_payment', totalAmount: order.totalAmount, statusToken: `st-${reference}`, payment: null };
  state.idem.set(key, { body: canon, response });
  return [201, response, { Location: `/v1/orders/${reference}/status` }];
}

const summary = ({ lines, cancelledAt, donorName, donorEmail, ...o }) => o;

function listing(url) {
  const p = url.searchParams;
  const sort = p.get('sort');
  const base = data[`/catalog/projects?pageSize=100${sort && sort !== 'featured' ? `&sort=${sort}` : ''}`];
  let items = base.items;
  if (p.get('category')) items = items.filter((i) => i.categorySlug === p.get('category'));
  const q = p.get('q')?.trim().toLowerCase();
  if (q) items = items.filter((i) => `${i.titleAr} ${i.titleEn} ${i.summaryAr} ${i.summaryEn}`.toLowerCase().includes(q));
  const page = Number(p.get('page') ?? 1);
  const pageSize = Number(p.get('pageSize') ?? 20);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

function route(req, url, body) {
  const method = req.method ?? 'GET';
  const path = url.pathname.replace(/^\/v1/, '');
  const key = path + url.search;
  const bearer = /^Bearer stub-token$/.test(req.headers.authorization ?? '');
  const signedIn = state.signedIn && bearer;
  const hasRefresh = /(?:^|;\s*)stub_rt=1/.test(req.headers.cookie ?? '');

  if (method === 'POST' && path === '/__reset') return reset(), [204, null];
  if (method === 'GET' && url.pathname === '/dev/sms') return [200, [...state.sms].reverse()];

  // catalogue
  if (method === 'GET' && key in data) return [200, data[key]];
  if (method === 'GET' && path === '/catalog/projects') return [200, listing(url)];
  if (method === 'GET' && path.startsWith('/catalog/projects/')) return [404, problem(404, 'project.not_found')];

  // donor auth
  if (method === 'POST' && path === '/auth/otp/request') {
    const to = `+9665${String(body?.mobile ?? '').replace(/\D/g, '').slice(-8)}`;
    state.sms.push({ sentAt: new Date().toISOString(), to, body: 'رمز الدخول لمتجر تعلّم: 123456 — صالح 5 دقائق.' });
    return [202, { expiresInSeconds: 300 }];
  }
  if (method === 'POST' && path === '/auth/otp/verify') {
    if (!/^\d{6}$/.test(body?.code ?? '')) return [400, problem(400, 'otp.invalid', { attemptsLeft: 4 })];
    state.signedIn = true;
    const mobile = `+9665${String(body.mobile).replace(/\D/g, '').slice(-8)}`;
    state.me ??= ME(mobile);
    return [
      200,
      {
        accessToken: 'stub-token',
        expiresIn: 900,
        customer: { ...state.me, isNew: true, profileComplete: !!(state.me.fullName && state.me.email) },
        cartNotices: [],
      },
      { 'Set-Cookie': 'stub_rt=1; Path=/v1/auth; HttpOnly; SameSite=Lax' },
    ];
  }
  if (method === 'POST' && path === '/auth/refresh')
    return state.signedIn && hasRefresh ? [200, { accessToken: 'stub-token', expiresIn: 900 }] : [401, problem(401, 'auth.refresh_invalid')];
  if (method === 'POST' && (path === '/auth/logout' || path === '/auth/logout-all')) {
    state.signedIn = false;
    return [204, null, { 'Set-Cookie': 'stub_rt=; Path=/v1/auth; Max-Age=0' }];
  }
  if (method === 'POST' && path === '/admin/auth/refresh') return [401, problem(401, 'auth.refresh_invalid')];

  // cart
  if (method === 'GET' && path === '/cart/summary') {
    const v = cartView();
    return [200, { lineCount: v.lineCount, totalAmount: v.totalAmount }];
  }
  if (method === 'GET' && path === '/cart') return [200, cartView()];
  if (method === 'POST' && path === '/cart/lines') return addLine(body);
  if (method === 'PATCH' && path.startsWith('/cart/lines/')) return patchLine(path.split('/').pop(), body);
  if (method === 'DELETE' && path.startsWith('/cart/lines/')) {
    const before = state.cart.length;
    state.cart = state.cart.filter((l) => l.id !== path.split('/').pop());
    return before === state.cart.length ? [404, problem(404, 'cart.line_not_found')] : [200, cartView()];
  }
  if (method === 'DELETE' && path === '/cart') return (state.cart = []), [204, null];
  if (method === 'POST' && path === '/checkout/quote')
    return state.cart.length ? [200, cartView()] : [409, problem(409, 'checkout.cart_empty')];

  // signed-in donor
  const ref = /^\/orders\/([^/]+)\/status$/.exec(path)?.[1];
  if (method === 'GET' && ref) {
    const o = state.orders.find((x) => x.reference === ref);
    const ok = o && (signedIn || url.searchParams.get('t') === `st-${ref}`);
    return ok ? [200, summary(o)] : [404, problem(404, 'order.not_found')];
  }
  if (path === '/checkout' || path.startsWith('/me')) {
    if (!signedIn) return [401, problem(401, 'auth.unauthenticated')];
    if (method === 'POST' && path === '/checkout') return checkout(req, body);
    if (method === 'GET' && path === '/me') return [200, state.me];
    if (method === 'PATCH' && path === '/me') {
      for (const k of ['fullName', 'email', 'locale', 'marketingOptIn'])
        if (body?.[k] !== undefined && body?.[k] !== null) state.me[k] = typeof body[k] === 'string' ? body[k].trim() || null : body[k];
      return [200, state.me];
    }
    if (method === 'DELETE' && path === '/me') {
      reset();
      return [204, null, { 'Set-Cookie': 'stub_rt=; Path=/v1/auth; Max-Age=0' }];
    }
    if (method === 'GET' && path === '/me/export')
      return [200, { profile: state.me, donations: state.orders.map(({ lineCount, ...o }) => o), exportedAt: '2026-10-25T12:00:00+00:00' }];
    if (method === 'GET' && path === '/me/donations')
      return [200, { items: state.orders.map(summary), total: state.orders.length, page: 1, pageSize: 20 }];
    const dref = /^\/me\/donations\/([^/]+)$/.exec(path)?.[1];
    if (method === 'GET' && dref) {
      const o = state.orders.find((x) => x.reference === dref);
      return o ? [200, (({ lineCount, ...d }) => d)(o)] : [404, problem(404, 'order.not_found')];
    }
  }
  return [404, problem(404, 'http.not_found')];
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  const origin = req.headers.origin;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (origin)
    Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'ETag, Retry-After, Location, Idempotent-Replayed',
    });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...headers,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE',
      'Access-Control-Allow-Headers': 'content-type,authorization,idempotency-key,accept-language',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }
  if (url.pathname === '/health/ready' || url.pathname === '/health/live') {
    res.writeHead(200, headers);
    return res.end('{"status":"Healthy"}');
  }
  if (url.pathname in files) {
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' });
    return res.end(Buffer.from(files[url.pathname], 'base64'));
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let body = null;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
    } catch {
      res.writeHead(400, { ...headers, 'Content-Type': 'application/problem+json' });
      return res.end(JSON.stringify(problem(400, 'validation.failed')));
    }
    const [status, out, extra = {}] = route(req, url, body);
    res.writeHead(status, { ...headers, ...(status >= 400 ? { 'Content-Type': 'application/problem+json' } : {}), ...extra });
    res.end(status === 204 || out === null ? undefined : JSON.stringify(out));
  });
}).listen(PORT, () =>
  console.log(`stub-api: listening on ${ORIGIN}/v1 (${Object.keys(data).length - 1} recorded responses, API ${data.meta.apiCommit})`),
);
