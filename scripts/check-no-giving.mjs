#!/usr/bin/env node
/**
 * r4 guard (scope-change-r4-no-giving.md): no giving UI. The OpenAPI file is still pre-r4, so the generated types carry
 * giving schemas — app code must never use them. Fails on any giving schema name or giving route in src/app (the
 * generated store-api.types.ts itself is skipped). Neutral values the pre-r4 API requires are sent from
 * core/api/pre-r4.ts only (DECISIONS: pre-r4 API), which is the one allowed file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/app';
const ALLOWED = new Set(['src/app/core/api/store-api.types.ts', 'src/app/core/api/pre-r4.ts']);
const BANNED = [
  /\b\w*(Giving|Sponsor(ship)?|Cause|Dedication|Zakat|Beneficiar\w*|Allocation|Donat\w*|GoalProgress|Pool)\w*\b/,
  /['"`]\/?(me\/giving|cards\/|admin\/(beneficiaries|allocation|zakat|offers|cause-updates|dedications))/,
  /\bsadaqa\b|\bzakat\b/i,
];
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|html)$/.test(n) ? [p] : [];
  });
const problems = [];
for (const f of files(ROOT)) {
  if (ALLOWED.has(f) || f.endsWith('.spec.ts')) continue; // specs may name giving terms to assert their absence
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const re of BANNED) {
      const m = line.match(re);
      if (m) problems.push(`${f}:${i + 1}: "${m[0]}" — giving is out of scope (r4)`);
    }
  });
}
if (problems.length) {
  console.error(`check-no-giving: ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('check-no-giving: no giving types, routes or wording in src/app');
