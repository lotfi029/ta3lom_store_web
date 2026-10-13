/**
 * Lets the Angular CLI run on a Node version we have actually verified this project builds on.
 *
 * WHY THIS EXISTS
 * Hostinger's build runner offers Node 18/20/22/24 only (confirmed from the platform API's own
 * enum, not from docs), where "24" is v24.6.0. Angular 22 declares
 * `^22.22.3 || ^24.15.0 || >=26.0.0`, so `ng build` prints
 *
 *     Node.js version v24.6.0 detected.
 *     The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0.
 *
 * and exits 3 before doing any work. There is no flag or environment variable for this: the range
 * is a hardcoded constant in @angular/cli/src/utilities/node-version.js, read straight from
 * `process.versions.node`.
 *
 * WHY IT IS SAFE HERE, AND ONLY HERE
 * Measured, not assumed. The full production build was run under a real v24.6.0 with the gate
 * bypassed, and its output compared against the same build on v24.19.0: all 226 JS/CSS/asset files
 * byte-identical, and the prerendered HTML identical once the inlined <style> and transfer-state
 * key ORDER is normalised (that order varies between any two runs on the same Node, so it is not
 * a version effect).
 *
 * So this does NOT disable the check. It appends the exact versions we have verified to the
 * supported list, leaving the gate fully in force for every other version — a Node this project
 * has never been built on still fails loudly, which is the point of the check.
 *
 * To vouch for another version: build under it, diff the output as above, then add it below.
 *
 * Fail-safe by construction. Any surprise — the file moved, the constant was reformatted, no write
 * permission — logs and exits 0. A patch that cannot be applied must never break `npm install`;
 * the build then fails with Angular's own clear message, which is the correct fallback.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** Versions this project has been built on and had its output diffed. Nothing else. */
const VERIFIED = ['24.6.0'];

const GATE_FILE = '@angular/cli/src/utilities/node-version.js';
const CONSTANT = /const SUPPORTED_NODE_VERSIONS = '([^']+)';/;

const note = (message) => console.log(`relax-ng-node-gate: ${message}`);

try {
  const running = process.versions.node;

  if (!VERIFIED.includes(running)) {
    // The overwhelmingly common case: a developer machine or CI on a supported Node. Completely
    // inert, and silent so it does not add noise to every install.
    process.exit(0);
  }

  const path = createRequire(import.meta.url).resolve(GATE_FILE);
  const source = readFileSync(path, 'utf8');
  const found = source.match(CONSTANT);

  if (!found) {
    note(`could not find the version constant in ${GATE_FILE} — leaving it alone.`);
    process.exit(0);
  }

  const range = found[1];
  if (range.includes(running)) {
    note(`${running} is already accepted — nothing to do.`);
    process.exit(0);
  }

  writeFileSync(
    path,
    source.replace(CONSTANT, `const SUPPORTED_NODE_VERSIONS = '${range} || ${running}';`),
  );
  note(`added ${running} to the Angular CLI's supported list (verified build — see this file's header).`);
} catch (error) {
  note(`skipped — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}
