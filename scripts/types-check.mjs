#!/usr/bin/env node
/** Fails when src/app/core/api/store-api.types.ts is stale against docs/openapi/store-api.v1.json (`npm run types:gen`). */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'types-')), 'store-api.types.ts');
execFileSync(process.execPath, ['node_modules/openapi-typescript/bin/cli.js', 'docs/openapi/store-api.v1.json', '-o', out], { stdio: 'ignore' });
if (readFileSync(out, 'utf8') !== readFileSync('src/app/core/api/store-api.types.ts', 'utf8')) {
  console.error('types:check: src/app/core/api/store-api.types.ts is stale — run `npm run types:gen` and commit it.');
  process.exit(1);
}
console.log('types:check: store-api.types.ts matches docs/openapi/store-api.v1.json');
