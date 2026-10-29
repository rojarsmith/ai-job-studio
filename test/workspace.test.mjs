import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveWorkspace, initWorkspace, checkWorkspace, REQUIRED, LAYOUT } from '../lib/workspace.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-ws-'));

test('resolve order: flag > env > .workspace > default', () => {
  const root = path.join(tmp, 'repo'); fs.mkdirSync(root, { recursive: true });
  assert.equal(resolveWorkspace({ argv: [], env: {}, root }).dir, path.join(root, 'workspace'));
  fs.writeFileSync(path.join(root, '.workspace'), '# comment\n../ptr\n');
  assert.equal(resolveWorkspace({ argv: [], env: {}, root }).via, '.workspace');
  assert.equal(resolveWorkspace({ argv: [], env: {}, root }).dir, path.resolve(root, '../ptr'));
  assert.equal(resolveWorkspace({ argv: [], env: { JOB_WORKSPACE: 'E:/x' }, root }).via, 'JOB_WORKSPACE');
  assert.equal(resolveWorkspace({ argv: ['init', '--workspace', 'F:/y'], env: { JOB_WORKSPACE: 'E:/x' }, root }).dir, path.resolve('F:/y'));
});
test('init creates layout + required files + .gitignore, never overwrites', () => {
  const dir = path.join(tmp, 'ws');
  initWorkspace(dir);
  for (const f of REQUIRED) assert.ok(fs.existsSync(path.join(dir, f)), f);
  for (const d of LAYOUT) assert.ok(fs.statSync(path.join(dir, d)).isDirectory(), d);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /profiles\//);
  fs.writeFileSync(path.join(dir, 'cv.md'), 'mine');
  initWorkspace(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'cv.md'), 'utf8'), 'mine');
});
test('check flags missing files and reports example cv', () => {
  const dir = path.join(tmp, 'ws2');
  initWorkspace(dir);
  let r = checkWorkspace(dir, { root: path.join(tmp, 'repo') });
  assert.equal(r.ok, true, r.problems.join('; '));
  assert.ok(r.notes.some((n) => /still looks like the example/.test(n)));
  fs.rmSync(path.join(dir, 'config', 'profile.yml'));
  r = checkWorkspace(dir, { root: path.join(tmp, 'repo') });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => /profile\.yml/.test(p)));
});
