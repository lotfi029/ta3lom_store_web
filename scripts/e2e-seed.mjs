#!/usr/bin/env node
/**
 * Seeds the local store API for e2e (plan §4 "Real API"). Idempotent — safe to run before every DoD pass.
 *   1. Staff: one per r4 role (admin via the API's `create-admin` CLI; the rest created by that admin), each signed in
 *      once through password + TOTP so the secret is recorded in .e2e/staff.json (git-ignored).
 *   2. r4 catalogue: the API's reference seed still holds giving `cause` products (pre-r4 API) — they are archived so the
 *      storefront shows courses and books only (DECISIONS: pre-r4 API).
 *   3. Book formats: print stock topped up to ≥ 200; every digital format gets a private PDF file so downloads work.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Client, STAFF_FILE, readStaff, staffLogin, writeStaff } from './lib/store-api-client.mjs';

const API_DIR = process.env.STORE_API_DIR ?? join(process.cwd(), '..', 'ta3lom_store_api');
const DLL = join(API_DIR, 'src/Ta3lom.Store.Api/bin/Debug/net10.0/Ta3lom.Store.Api.dll');
const ROLES = ['store_manager', 'finance', 'fulfilment', 'viewer'];
const log = (m) => console.log(`e2e-seed: ${m}`);

async function ensureAdmin(staff) {
  if (staff.admin) {
    try {
      return await staffLogin(staff.admin);
    } catch (e) {
      log(`saved admin cannot sign in (${e.message.slice(0, 80)}) — creating a new one`);
    }
  }
  const email = `e2e-admin-${Date.now().toString(36)}@store-web.test`;
  const out = execFileSync(
    'dotnet',
    [DLL, 'create-admin', '--email', email, '--name', 'E2E Admin'],
    {
      cwd: join(API_DIR, 'src/Ta3lom.Store.Api'),
      encoding: 'utf8',
    },
  );
  const password = out.match(/shown once\):\s*(\S+)/)?.[1];
  if (!password) throw new Error(`create-admin printed no password:\n${out}`);
  staff.admin = { email, password, roles: ['admin'] };
  const c = await staffLogin(staff.admin);
  writeStaff(staff);
  log(`admin ${email} created`);
  return c;
}

async function ensureRole(admin, staff, role) {
  if (staff[role]) {
    try {
      await staffLogin(staff[role]);
      return;
    } catch {
      /* recreate below */
    }
  }
  const email = `e2e-${role.replace('_', '-')}-${Date.now().toString(36)}@store-web.test`;
  const r = await admin.call('POST', '/v1/admin/staff', {
    email,
    name: `E2E ${role}`,
    roles: [role],
  });
  if (r.status !== 201) throw new Error(`create ${role}: ${r.status} ${JSON.stringify(r.body)}`);
  staff[role] = { email, password: r.body.oneTimePassword, roles: [role] };
  await staffLogin(staff[role]);
  writeStaff(staff);
  log(`${role} ${email} created`);
}

function minimalPdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  offsets.push(out.length);
  out += '4 0 obj\n<< /Length 5 >>\nstream\nBT ET\nendstream\nendobj\n';
  const xref = out.length;
  out += `xref\n0 5\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function catalogue(manager) {
  const list = await manager.call('GET', '/v1/admin/products?pageSize=100');
  if (list.status !== 200)
    throw new Error(`admin products: ${list.status} ${JSON.stringify(list.body)}`);
  let archived = 0;
  for (const p of list.body.items) {
    if (p.type === 'cause' && p.status !== 'archived') {
      const r = await manager.call('POST', `/v1/admin/products/${p.id}/archive`);
      if (r.status !== 200)
        throw new Error(`archive ${p.slug}: ${r.status} ${JSON.stringify(r.body)}`);
      archived += 1;
    }
  }
  log(`causes archived: ${archived} (r4 — courses and books only)`);

  // The reference catalogue points digital formats at files (private/books/<slug>.pdf) that local storage does not hold,
  // so every digital format gets a file uploaded by this seed; the asset ids are remembered to stay idempotent.
  const seededFile = join(dirname(STAFF_FILE), 'seeded-files.json');
  const seeded = new Set(
    existsSync(seededFile) ? JSON.parse(readFileSync(seededFile, 'utf8')) : [],
  );
  for (const p of list.body.items.filter((x) => x.type === 'book')) {
    const detail = await manager.call('GET', `/v1/admin/products/${p.id}`);
    for (const f of detail.body.formats ?? []) {
      if (f.kind === 'digital' && !seeded.has(f.fileAssetId)) {
        const form = new FormData();
        form.append('kind', 'book_file');
        form.append('file', new Blob([minimalPdf()], { type: 'application/pdf' }), `${p.slug}.pdf`);
        const asset = await manager.call('POST', '/v1/admin/media', form);
        if (asset.status !== 201 && asset.status !== 200)
          throw new Error(`upload ${p.slug}: ${asset.status} ${JSON.stringify(asset.body)}`);
        const upd = await manager.call('PUT', `/v1/admin/formats/${f.id}`, {
          kind: f.kind,
          sku: f.sku,
          price: f.price,
          compareAtPrice: f.compareAtPrice ?? null,
          isActive: f.isActive ?? true,
          weightGrams: f.weightGrams ?? null,
          lowStockThreshold: f.lowStockThreshold ?? null,
          fileAssetId: asset.body.id,
        });
        if (upd.status !== 200)
          throw new Error(`link file ${p.slug}: ${upd.status} ${JSON.stringify(upd.body)}`);
        seeded.add(asset.body.id);
        writeFileSync(seededFile, JSON.stringify([...seeded]));
        log(`digital file linked for ${p.slug}`);
      }
    }
  }
}

async function stock(admin) {
  const rows = await admin.call('GET', '/v1/admin/stock');
  for (const row of rows.body ?? []) {
    if (row.available < 200) {
      const r = await admin.call('POST', `/v1/admin/stock/${row.formatId}/movements`, {
        delta: 500,
        reason: 'restock',
        note: 'e2e seed',
      });
      if (r.status !== 201)
        throw new Error(`restock ${row.sku}: ${r.status} ${JSON.stringify(r.body)}`);
      log(`restocked ${row.sku}`);
    }
  }
}

const staff = readStaff();
const admin = await ensureAdmin(staff);
for (const role of ROLES) await ensureRole(admin, staff, role);
writeStaff(staff);
const manager = await staffLogin(staff.store_manager);
await catalogue(manager);
const fulfilment = await staffLogin(staff.fulfilment);
await stock(fulfilment.token ? fulfilment : admin);
const pub = await new Client().call('GET', '/v1/catalog/products?pageSize=100');
log(`done — ${pub.body.total} public products (${pub.body.items.map((p) => p.type).join(', ')})`);
