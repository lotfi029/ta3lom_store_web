import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { API } from './api';
// Test tooling shared with the seed script (TOTP, staff credentials from e2e/.auth/staff.json).
import { readStaff, staffLogin } from '../../scripts/lib/store-api-client.mjs';
import { totp } from '../../scripts/lib/totp.mjs';

/** A fresh Saudi mobile per test (`055` + 7 digits), so OTP limits and carts never collide. */
export function freshMobile(): string {
  return `055${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

export type StaffRole = 'admin' | 'store_manager' | 'finance' | 'viewer';

/** The newest OTP the API's dev SMS sink holds for this mobile (`GET /dev/sms`, Development only). */
export async function otpFor(mobile05: string, after = 0): Promise<string> {
  const e164 = `+966${mobile05.slice(1)}`;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${API.replace(/\/v1$/, '')}/dev/sms?count=50`);
    const list = (await res.json()) as { to: string; body: string; sentAt: string }[];
    const msg = list.find((m) => m.to === e164 && Date.parse(m.sentAt) >= after);
    const code = msg?.body.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no OTP for ${mobile05}`);
}

/**
 * R3-1 — local e2e only. The API's OTP caps (3 codes per mobile / 15 min, 10 per IP / hour) are code constants counted
 * in `store.otp_challenge`; neither the env nor /dev can raise or reset them, while the whole suite signs in from
 * 127.0.0.1. Before each signing-in spec the challenges are deleted from the LOCAL dev database — and only there: it
 * refuses unless the host is localhost and the database is the local dev database. Mobiles stay unique per test.
 * Against the stub (CI) there is nothing to reset.
 */
export function resetOtpChallenges(): void {
  if (/localhost:3000/.test(API)) return;
  const host = process.env['PGHOST'] ?? 'localhost';
  const db = process.env['PGDATABASE'] ?? 'ta3lom_store_dev';
  if (
    !['localhost', '127.0.0.1', '::1'].includes(host) ||
    db !== 'ta3lom_store_dev' ||
    !/\/\/localhost:5080\//.test(API)
  )
    throw new Error(
      `resetOtpChallenges: refusing to touch ${host}/${db} (local dev database only)`,
    );
  execFileSync(
    'psql',
    [
      '-h',
      host,
      '-p',
      process.env['PGPORT'] ?? '5440',
      '-U',
      'postgres',
      '-d',
      db,
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
  returnUrl = '/account/donations',
): Promise<string> {
  resetOtpChallenges();
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
export async function staff(role: StaffRole) {
  const entry = readStaff()[role];
  if (!entry) throw new Error(`no ${role} in e2e/.auth/staff.json — run npm run api:seed`);
  return staffLogin(entry);
}

/** Signs a seeded staff user in through /admin/login (password, then the TOTP code from the stored secret). */
export async function staffSignIn(
  page: Page,
  locale: 'ar' | 'en',
  role: StaffRole,
  returnPath = '/admin',
) {
  const entry = readStaff()[role];
  if (!entry?.secret)
    throw new Error(`no ${role} with TOTP in e2e/.auth/staff.json — run npm run api:seed`);
  await page.goto(
    `/${locale}/admin/login${returnPath === '/admin' ? '' : `?returnUrl=${encodeURIComponent(returnPath)}`}`,
  );
  await page.locator('#al-email').fill(entry.email);
  await page.locator('#al-password').fill(entry.password);
  await page.locator('#al-password').press('Enter');
  await expect(page.locator('#al-code')).toBeFocused();
  const done = new RegExp(`/${locale}${returnPath.replace(/[?]/g, '\\?')}$`);
  await page.locator('#al-code').fill(totp(entry.secret));
  await page.locator('#al-code').press('Enter');
  // A TOTP step is never accepted twice (the seed or an earlier test may have used it): wait for the next step once.
  const refused = page.locator('.form-error');
  await expect(page.locator('#al-code').or(refused).first()).toBeAttached();
  await Promise.race([
    page.waitForURL(done, { timeout: 10_000 }).catch(() => undefined),
    refused.waitFor({ timeout: 10_000 }).catch(() => undefined),
  ]);
  if (!done.test(page.url()) && (await refused.isVisible())) {
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1000);
    await page.locator('#al-code').fill(totp(entry.secret));
    await page.locator('#al-code').press('Enter');
  }
  await expect(page).toHaveURL(done);
}
