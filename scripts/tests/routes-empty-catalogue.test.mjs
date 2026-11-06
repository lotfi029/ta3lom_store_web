// First deploy (empty catalogue): routes.mjs refuses an empty store unless ALLOW_EMPTY_CATALOGUE=1 (the repository
// variable the deploy workflow turns into that build arg). Runs the real script against a one-route local API, in a temp
// folder so the repository's generated files are not touched.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT = resolve('scripts/routes.mjs');
let server;
let api;

before(async () => {
  server = createServer((req, res) => {
    res.writeHead(req.url === '/v1/catalog/projects?fields=slug' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ slugs: [] }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  api = `http://127.0.0.1:${server.address().port}/v1`;
});
after(() => server.close());

function run(extraEnv) {
  const cwd = mkdtempSync(join(tmpdir(), 'routes-'));
  mkdirSync(join(cwd, 'public'));
  mkdirSync(join(cwd, 'src', 'app'), { recursive: true });
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd,
      env: { ...process.env, DEPLOY_ENV: 'production', PRERENDER_API_URL: api, ALLOW_EMPTY_CATALOGUE: '', ...extraEnv },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => done({ code, out, cwd }));
  });
}

test('an empty catalogue fails the build by default', async () => {
  const r = await run({});
  assert.equal(r.code, 1);
  assert.match(r.out, /refusing to build an empty store/);
});

test('ALLOW_EMPTY_CATALOGUE=1 (first deploy) builds the home page only, with a warning', async () => {
  const r = await run({ ALLOW_EMPTY_CATALOGUE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARNING.*empty catalogue/i);
  assert.equal(readFileSync(join(r.cwd, 'routes.txt'), 'utf8'), '/ar/\n/en/\n');
  assert.match(readFileSync(join(r.cwd, 'src/app/prerender-manifest.ts'), 'utf8'), /PROJECT_SLUGS: string\[\] = \[\]/);
});

test('any other value keeps the guard', async () => {
  assert.equal((await run({ ALLOW_EMPTY_CATALOGUE: 'true' })).code, 1);
});
