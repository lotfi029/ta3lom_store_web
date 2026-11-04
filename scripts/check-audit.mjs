#!/usr/bin/env node
/**
 * npm audit gate (owner M-9): fails on any HIGH or CRITICAL advisory in PRODUCTION dependencies (`--omit=dev`) unless
 * audit-allowlist.json lists it with a reason and an expiry at most 30 days after it was added. An expired entry, or one
 * longer than 30 days, fails the gate by itself — so an accepted risk is looked at again every month.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DAY = 86_400_000;
const today = new Date(new Date().toISOString().slice(0, 10));
const list = JSON.parse(readFileSync('audit-allowlist.json', 'utf8')).entries ?? [];
const problems = [];
const allowed = new Map();
for (const e of list) {
  const added = new Date(e.added);
  const expires = new Date(e.expires);
  if (!e.id || !e.reason || Number.isNaN(+added) || Number.isNaN(+expires)) {
    problems.push(`allowlist entry ${JSON.stringify(e)} needs id, reason, added and expires`);
    continue;
  }
  if (expires - added > 30 * DAY) problems.push(`allowlist ${e.id}: expires more than 30 days after it was added`);
  if (expires < today) problems.push(`allowlist ${e.id} expired on ${e.expires} — fix the dependency or renew with a reason`);
  else allowed.set(e.id, e);
}

let report;
// CHECK_AUDIT_REPORT=<file>: read a saved report instead of running npm (used by scripts/check-audit.spec.mjs).
if (process.env.CHECK_AUDIT_REPORT !== undefined) report = readFileSync(process.env.CHECK_AUDIT_REPORT, 'utf8');
else try {
  report = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  report = e.stdout; // npm audit exits 1 when it finds anything
}
// Fail closed (review 06 D-4): no output, unparsable output or a report without `metadata` means the audit did not run
// (network, registry, npm crash) — never "no advisories".
let data;
try {
  data = JSON.parse(report ?? '');
} catch {
  console.error(`check-audit: npm audit produced no JSON output (${(report ?? '').trim() ? 'unparsable' : 'empty'}) — failing closed`);
  process.exit(1);
}
if (!data || typeof data !== 'object' || !data.metadata) {
  console.error('check-audit: npm audit output has no metadata — the audit did not run; failing closed');
  process.exit(1);
}
if (data.error) {
  console.error(`check-audit: npm audit failed: ${JSON.stringify(data.error).slice(0, 300)}`);
  process.exit(1);
}
const found = [];
for (const [name, v] of Object.entries(data.vulnerabilities ?? {}))
  for (const via of v.via ?? [])
    if (typeof via === 'object' && ['high', 'critical'].includes(via.severity)) {
      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? String(via.source);
      found.push({ id, name, severity: via.severity, title: via.title });
    }
for (const f of found)
  if (!allowed.has(f.id)) problems.push(`${f.severity} ${f.id} in ${f.name}: ${f.title}`);
  else console.warn(`check-audit: allowed until ${allowed.get(f.id).expires}: ${f.id} (${allowed.get(f.id).reason})`);

if (problems.length) {
  console.error(`check-audit: ${problems.length} problem(s) in production dependencies:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`check-audit: no high/critical advisory in production dependencies (${list.length} allowlist entr${list.length === 1 ? 'y' : 'ies'}).`);
