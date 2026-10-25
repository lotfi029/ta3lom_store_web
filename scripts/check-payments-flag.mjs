#!/usr/bin/env node
/**
 * D-W2 production guard: online payment arrives with R5-Payments. Until `paymentsEnabled` is true in
 * src/environments/environment.production.ts, a production build (`npm run build:prod`) FAILS — the store must not go
 * live where checkout ends at "payment coming soon".
 *
 * The only exception is the CI dry run of the production build against the stub, which sets
 * ALLOW_PAYMENTS_DISABLED=1 to exercise every other production gate (never the deploy workflow). It prints a warning.
 */
import { readFileSync } from 'node:fs';

const FILE = 'src/environments/environment.production.ts';
const m = /paymentsEnabled:\s*(true|false)/.exec(readFileSync(FILE, 'utf8'));
if (!m) {
  console.error(`check-payments-flag: ${FILE} has no "paymentsEnabled: true|false".`);
  process.exit(1);
}
if (m[1] === 'true') {
  console.log('check-payments-flag: paymentsEnabled is true — production build allowed.');
} else if (process.env.ALLOW_PAYMENTS_DISABLED === '1') {
  console.warn(
    'check-payments-flag: WARNING — paymentsEnabled is false; continuing ONLY because ALLOW_PAYMENTS_DISABLED=1 ' +
      '(CI dry run). This output must not be deployed.',
  );
} else {
  console.error(
    'check-payments-flag: paymentsEnabled is false in environment.production.ts — production is blocked until ' +
      'R5-Payments (D-W2). For the CI dry run only, set ALLOW_PAYMENTS_DISABLED=1.',
  );
  process.exit(1);
}
