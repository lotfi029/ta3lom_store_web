/**
 * Minimal store-API client for test tooling (seed script, Playwright helpers): JSON calls, cookie jar, bearer.
 * Never imported by the app. Staff credentials live in .e2e/staff.json (git-ignored, local dev data only).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totp } from './totp.mjs';

export const API_ORIGIN = (process.env.STORE_API_URL ?? 'http://localhost:5080/v1').replace(
  /\/v1\/?$/,
  '',
);
export const STAFF_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.e2e',
  'staff.json',
);

export class Client {
  constructor() {
    this.cookies = new Map();
    this.token = null;
  }
  async call(method, path, body, headers = {}) {
    const h = { Origin: 'http://localhost:4320', 'Accept-Language': 'ar', ...headers };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      payload = JSON.stringify(body);
      h['Content-Type'] = 'application/json';
    }
    const res = await fetch(path.startsWith('http') ? path : API_ORIGIN + path, {
      method,
      headers: h,
      body: payload,
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (value && !/max-age=0|expires=thu, 01 jan 1970/i.test(c))
        this.cookies.set(name.trim(), value);
      else this.cookies.delete(name.trim());
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }
}

export function readStaff() {
  return existsSync(STAFF_FILE) ? JSON.parse(readFileSync(STAFF_FILE, 'utf8')) : {};
}
export function writeStaff(staff) {
  mkdirSync(dirname(STAFF_FILE), { recursive: true });
  writeFileSync(STAFF_FILE, JSON.stringify(staff, null, 2));
}

/** Signs a staff user in (password, then TOTP; enrols on first sign-in and records the secret). */
export async function staffLogin(entry) {
  const c = new Client();
  const login = await c.call('POST', '/v1/admin/auth/login', {
    email: entry.email,
    password: entry.password,
  });
  if (login.status !== 200)
    throw new Error(`staff login ${entry.email}: ${login.status} ${JSON.stringify(login.body)}`);
  c.token = login.body.mfaToken;
  if (!login.body.totpEnrolled) {
    const enrol = await c.call('POST', '/v1/admin/auth/totp/enrol');
    if (enrol.status !== 200)
      throw new Error(`totp enrol ${entry.email}: ${enrol.status} ${JSON.stringify(enrol.body)}`);
    entry.secret = enrol.body.secretBase32;
  }
  const verify = await c.call('POST', '/v1/admin/auth/totp/verify', { code: totp(entry.secret) });
  if (verify.status !== 200)
    throw new Error(`totp verify ${entry.email}: ${verify.status} ${JSON.stringify(verify.body)}`);
  c.token = verify.body.accessToken;
  c.session = verify.body;
  return c;
}

/** Latest OTP code sent to a Saudi mobile (05…), read from the API's dev SMS sink. */
export async function latestOtp(mobile05) {
  const e164 = `+966${mobile05.slice(1)}`;
  const { body } = await new Client().call('GET', '/dev/sms?count=50');
  const msg = (body ?? []).find((m) => m.to === e164);
  return msg?.body.match(/\d{6}/)?.[0] ?? null;
}
