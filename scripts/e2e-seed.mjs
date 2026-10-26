#!/usr/bin/env node
/**
 * Seeds the local R5 store API for e2e. Idempotent — safe to run before every DoD pass.
 *   Staff: one per R5 role (admin via the API's `create-admin` CLI; store_manager, finance and viewer created by that
 *   admin). Each is signed in once: password → TOTP set-up (the secret is recorded) → the forced password change of
 *   new staff (a new strong password is recorded). Credentials: e2e/.auth/staff.json (git-ignored, E-4).
 *   Catalogue: the API's Development seed (3 categories, 6 published projects with options) — nothing to add here.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client, readStaff, staffLogin, writeStaff } from './lib/store-api-client.mjs';

const API_DIR = process.env.STORE_API_DIR ?? join(process.cwd(), '..', 'ta3lom_store_api');
const DLL = join(API_DIR, 'src/Ta3lom.Store.Api/bin/Debug/net10.0/Ta3lom.Store.Api.dll');
const ROLES = ['store_manager', 'finance', 'viewer'];
const log = (m) => console.log(`e2e-seed: ${m}`);

/** E-4: the CLI prints `One-time password (shown once): <password>`; anything else is a contract change — fail clearly. */
export function parseOneTimePassword(out) {
  const password = /One-time password \(shown once\):\s*(\S+)/.exec(out)?.[1];
  if (!password)
    throw new Error(
      `create-admin output changed — expected "One-time password (shown once): <password>", got:\n${out.slice(0, 500)}`,
    );
  return password;
}

async function ensureAdmin(staff) {
  if (staff.admin) {
    try {
      const c = await staffLogin(staff.admin);
      writeStaff(staff);
      return c;
    } catch (e) {
      log(`saved admin cannot sign in (${String(e.message).slice(0, 80)}) — creating a new one`);
    }
  }
  const email = `e2e-admin-${Date.now().toString(36)}@store-web.test`;
  const out = execFileSync('dotnet', [DLL, 'create-admin', '--email', email, '--name', 'E2E Admin'], {
    cwd: join(API_DIR, 'src/Ta3lom.Store.Api'),
    encoding: 'utf8',
  });
  staff.admin = { email, password: parseOneTimePassword(out), roles: ['admin'] };
  const c = await staffLogin(staff.admin);
  writeStaff(staff);
  log(`admin ${email} created (TOTP set up, forced password changed)`);
  return c;
}

async function ensureRole(admin, staff, role) {
  if (staff[role]) {
    try {
      await staffLogin(staff[role]);
      writeStaff(staff);
      return;
    } catch {
      /* recreate below */
    }
  }
  const email = `e2e-${role.replace('_', '-')}-${Date.now().toString(36)}@store-web.test`;
  const r = await admin.call('POST', '/v1/admin/staff', { email, name: `E2E ${role}`, roles: [role] });
  if (r.status !== 201) throw new Error(`create ${role}: ${r.status} ${JSON.stringify(r.body)}`);
  staff[role] = { email, password: r.body.oneTimePassword, roles: [role] };
  await staffLogin(staff[role]);
  writeStaff(staff);
  log(`${role} ${email} created`);
}

const staff = readStaff();
const admin = await ensureAdmin(staff);
for (const role of ROLES) await ensureRole(admin, staff, role);
writeStaff(staff);
const pub = await new Client().call('GET', '/v1/catalog/projects?pageSize=100');
const cats = await new Client().call('GET', '/v1/catalog/categories');
log(`done — ${pub.body.total} published projects, ${cats.body.length} active categories, staff: ${Object.keys(staff).join(', ')}`);
