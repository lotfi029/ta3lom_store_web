#!/usr/bin/env node
/**
 * R5 guard (B-2, E-5): the store is donations only. Fails the lint when any file under src/ contains one of the r4
 * commerce words or "giving" — case-insensitive, as a substring, exactly like the definition-of-done grep:
 *   grep -riE 'course|book|shipping|stock|enrol|giving' src/
 *
 * Allow-list (exact tokens, nothing broader — DECISIONS: check-no-commerce):
 *   - `facebook`                       the share target required by D-W5 (it contains "book")
 *   - `totp/enrol`                     the API path POST /v1/admin/auth/totp/enrol
 *   - `TotpEnrolResponse`, `totpEnrolled`, `auth.totp_not_enrolled`, `auth.totp_already_enrolled`
 *                                      API schema, field and error-code names the web must use verbatim
 *   - src/app/core/api/store-api.types.ts  generated from the API's OpenAPI document (not web-owned)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src';
const BANNED = /course|book|shipping|stock|enrol|giving/gi;
const ALLOWED_TOKENS = [
  'auth.totp_already_enrolled',
  'auth.totp_not_enrolled',
  'TotpEnrolResponse',
  'totpEnrolled',
  'totp/enrol',
  'facebook',
];
const ALLOWED_FILES = new Set(['src/app/core/api/store-api.types.ts']);
const BINARY = /\.(woff2?|png|jpe?g|webp|gif|ico|svg|pdf)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** The line with every allowed token blanked out (case-insensitive), so only real hits remain. */
function strip(line) {
  let out = line;
  for (const t of ALLOWED_TOKENS) out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'gi'), '');
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const rel = relative('.', file).split('\\').join('/');
  if (ALLOWED_FILES.has(rel) || BINARY.test(rel)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const words = strip(line).match(BANNED);
      if (words) hits.push(`${rel}:${i + 1}: ${[...new Set(words.map((w) => w.toLowerCase()))].join(', ')}`);
    });
}

if (hits.length) {
  console.error('check-no-commerce: r4 commerce words in src/ (donations only — see the allow-list in this script):');
  for (const h of hits.slice(0, 200)) console.error(`  ${h}`);
  if (hits.length > 200) console.error(`  … and ${hits.length - 200} more`);
  process.exit(1);
}
console.log('check-no-commerce: no course/book/shipping/stock/enrol/giving in src/ (allow-listed API tokens only)');
