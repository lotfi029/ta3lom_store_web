// Review 06 D-4: the npm audit gate fails closed. Runs scripts/check-audit.mjs on saved reports (CHECK_AUDIT_REPORT).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'check-audit-'));
function run(report) {
  const file = join(dir, `r${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, report);
  return spawnSync(process.execPath, ['scripts/check-audit.mjs'], {
    env: { ...process.env, CHECK_AUDIT_REPORT: file },
    encoding: 'utf8',
  });
}

test('empty output fails', () => assert.equal(run('').status, 1));
test('unparsable output fails', () => assert.equal(run('npm ERR! network').status, 1));
test('JSON without metadata fails', () => assert.equal(run('{}').status, 1));
test('a clean report passes', () =>
  assert.equal(run(JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } })).status, 0));
test('a high advisory not on the allow-list fails', () => {
  const report = {
    metadata: { vulnerabilities: { high: 1 } },
    vulnerabilities: {
      x: { via: [{ severity: 'high', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', title: 't' }] },
    },
  };
  assert.equal(run(JSON.stringify(report)).status, 1);
});
