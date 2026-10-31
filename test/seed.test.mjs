import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initWorkspace, lockOriginals } from '../lib/workspace.mjs';
import { planSeed, backupSource } from '../lib/seed.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-seed-'));

test('planSeed lists text originals, ignores binaries, reports lock state and the cv files it will replace', () => {
  const dir = path.join(tmp, 'ws');
  initWorkspace(dir);
  fs.writeFileSync(path.join(dir, 'original', 'resume.md'), '- shipped x');
  fs.mkdirSync(path.join(dir, 'original', 'notes'));
  fs.writeFileSync(path.join(dir, 'original', 'notes', 'a.txt'), 'n');
  fs.writeFileSync(path.join(dir, 'original', 'photo.png'), 'x');
  let p = planSeed(dir);
  assert.deepEqual(p.readable, ['notes/a.txt', 'resume.md']);
  assert.deepEqual(p.other, ['photo.png']);
  assert.equal(p.lock.unlocked.length, 3);
  assert.ok(p.replaces.includes('cv.md') && p.replaces.includes('cv.zh-TW.md'));
  lockOriginals(dir);
  p = planSeed(dir);
  assert.deepEqual(p.readable, ['notes/a.txt', 'resume.md']);
  assert.equal(p.lock.unlocked.length, 0);
});

test('backupSource copies cv*.md and leaves other source files alone', () => {
  const dir = path.join(tmp, 'ws2');
  initWorkspace(dir);
  fs.writeFileSync(path.join(dir, 'source', 'cv.md'), 'mine');
  const out = backupSource(dir, 'T1');
  assert.equal(fs.readFileSync(path.join(out, 'cv.md'), 'utf8'), 'mine');
  assert.ok(!fs.existsSync(path.join(out, 'profile.yml')));
  assert.equal(fs.readFileSync(path.join(dir, 'source', 'cv.md'), 'utf8'), 'mine');
});
