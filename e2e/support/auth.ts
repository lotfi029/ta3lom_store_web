import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { API } from './api';
// Test tooling shared with the seed script (TOTP, staff credentials from .e2e/staff.json).
import { readStaff, staffLogin } from '../../scripts/lib/store-api-client.mjs';
import { totp } from '../../scripts/lib/totp.mjs';

/** A fresh Saudi mobile per test (`055` + 7 digits), so OTP limits and carts never collide. */
export function freshMobile(): string {
  return `055${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

/** The newest OTP the API's dev SMS sink holds for this mobile (Development only, 11 §10.1). */
export async function otpFor(mobile05: string, after = 0): Promise<string> {
  const e164 = `+966${mobile05.slice(1)}`;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${API.replace(/\/v1$/, '')}/dev/sms?count=50`);
    const list = (await res.json()) as { to: string; body: string; sentAt: string }[];
    const msg = list.find((m) => m.to === e164 && Date.parse(m.sentAt) >= after);
    const code = msg?.body.match(/\d{6}/)?.[0];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no OTP for ${mobile05}`);
}

/**
 * Local e2e only: the API's per-IP OTP limit (10 codes / IP / hour, a domain constant — RUL-60) is meant for one person
 * per IP, while the whole suite signs in from 127.0.0.1. Old challenges are removed from the LOCAL dev database before
 * each request (never in CI or any shared environment). DECISIONS: e2e OTP limits.
 */
export function resetOtpLimits(): void {
  execFileSync(
    'psql',
    [
      '-h',
      'localhost',
      '-U',
      'postgres',
      '-d',
      process.env['PGDATABASE'] ?? 'ta3lom_store_dev',
      '-qc',
      'DELETE FROM store.otp_challenge',
    ],
    {
      env: { ...process.env, PGPASSWORD: process.env['PGPASSWORD'] ?? 'postgres' },
      stdio: 'ignore',
    },
  );
}

/** Signs in through the real /login page and returns the mobile used. */
export async function signIn(
  page: Page,
  locale: 'ar' | 'en',
  mobile = freshMobile(),
  returnUrl = '/courses',
): Promise<string> {
  resetOtpLimits();
  await page.goto(`/${locale}/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  const started = Date.now() - 50;
  await page.locator('#otp-mobile').fill(mobile);
  await page.locator('#otp-mobile').press('Enter');
  await expect(page.locator('#otp-code')).toBeFocused();
  await page.locator('#otp-code').fill(await otpFor(mobile, started));
  await expect(page).toHaveURL(new RegExp(`/${locale}${returnUrl.replace(/[?]/g, '\\?')}`));
  return mobile;
}

/** A signed-in staff API client for a role from the e2e seed (scripts/api-seed-e2e.sh). */
export async function staff(role: 'admin' | 'store_manager' | 'finance' | 'fulfilment' | 'viewer') {
  const entry = readStaff()[role];
  if (!entry) throw new Error(`no ${role} in .e2e/staff.json — run npm run api:seed`);
  return staffLogin(entry);
}

/** Signs a seeded staff user in through /admin/login (password, then the TOTP code from the stored secret). */
export async function staffSignIn(
  page: Page,
  locale: 'ar' | 'en',
  role: 'admin' | 'store_manager' | 'finance' | 'fulfilment' | 'viewer',
  returnPath = '/admin',
) {
  const entry = readStaff()[role];
  if (!entry?.secret)
    throw new Error(`no enrolled ${role} in .e2e/staff.json — run npm run api:seed`);
  await page.goto(
    `/${locale}/admin/login${returnPath === '/admin' ? '' : `?returnUrl=${encodeURIComponent(returnPath)}`}`,
  );
  await page.locator('#al-email').fill(entry.email);
  await page.locator('#al-password').fill(entry.password);
  await page.locator('#al-password').press('Enter');
  await expect(page.locator('#al-code')).toBeFocused();
  await page.locator('#al-code').fill(totp(entry.secret));
  await page.locator('#al-code').press('Enter');
  await expect(page).toHaveURL(new RegExp(`/${locale}${returnPath.replace(/[?]/g, '\\?')}$`));
}
