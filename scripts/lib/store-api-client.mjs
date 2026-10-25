/**
 * Minimal store-API client for test tooling (seed script, Playwright helpers): JSON calls, cookie jar, bearer.
 * Never imported by the app. Staff credentials and TOTP secrets live in e2e/.auth/staff.json (git-ignored, local dev
 * data only — E-4).
 */
import { randomBytes } from 'node:crypto';
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
  'e2e',
  '.auth',
  'staff.json',
);

/** A strong password for test staff (24 characters, never on the common-password list). */
export const strongPassword = () => `E2e-${randomBytes(15).toString('base64url')}`;

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

/**
 * Signs a staff user in: password, then TOTP (sets it up on first sign-in and records the secret), then — when the API
 * forces a password change (new or reset staff: `mustChangePassword`) — changes it to a new strong password, records
 * it, and continues with the fresh session. `entry` is updated in place; the caller saves it.
 */
export async function staffLogin(entry, retried = false) {
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
  if (verify.status === 401 && verify.body?.code === 'auth.totp_invalid' && !retried) {
    // A TOTP step is never accepted twice: a second sign-in within the same 30 s step waits for the next one.
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 1000));
    return staffLogin(entry, true);
  }
  if (verify.status !== 200)
    throw new Error(`totp verify ${entry.email}: ${verify.status} ${JSON.stringify(verify.body)}`);
  c.token = verify.body.accessToken;
  c.session = verify.body;
  if (verify.body.staff?.mustChangePassword) {
    const next = strongPassword();
    const change = await c.call('POST', '/v1/admin/auth/password', {
      currentPassword: entry.password,
      newPassword: next,
    });
    if (change.status !== 200)
      throw new Error(`password change ${entry.email}: ${change.status} ${JSON.stringify(change.body)}`);
    entry.password = next;
    c.token = change.body.accessToken;
    c.session = change.body;
  }
  return c;
}

/** Latest OTP code sent to a Saudi mobile (05…), read from the API's dev SMS sink. */
export async function latestOtp(mobile05) {
  const e164 = `+966${mobile05.slice(1)}`;
  const { body } = await new Client().call('GET', '/dev/sms?count=50');
  const msg = (body ?? []).find((m) => m.to === e164);
  return msg?.body.match(/\b\d{6}\b/)?.[0] ?? null;
}
