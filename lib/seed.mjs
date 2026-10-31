// original/ → source/ derivation support. The LLM does the rewriting (modes/seed.md); this file only plans and protects.
// Overwriting source/cv*.md is intended, so the previous copies are saved under generated/data/seed-backup/ first.
import fs from 'node:fs';
import path from 'node:path';
import { verifyOriginals } from './workspace.mjs';

const TEXT = /\.(md|markdown|txt|text)$/i;
const CV_FILE = /^cv(\.[A-Za-z-]+)?\.md$/;

/** Files in original/ that a mode can read, plus lock state and the source files that will be replaced. */
export function planSeed(dir) {
  const root = path.join(dir, 'original');
  if (!fs.existsSync(root)) throw new Error(`no original/ in ${dir} (run: node scripts/workspace.mjs init)`);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name !== '.lock.json') files.push(path.relative(root, f).split(path.sep).join('/'));
    }
  };
  walk(root);
  const readable = files.filter((f) => TEXT.test(f)).sort();
  const other = files.filter((f) => !TEXT.test(f)).sort();
  const lock = verifyOriginals(dir);
  const srcDir = path.join(dir, 'source');
  const replaces = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => CV_FILE.test(f)).sort() : [];
  return { readable, other, lock, replaces };
}

/** Copy the existing source/cv*.md into generated/data/seed-backup/<stamp>/. Returns the backup dir or null. */
export function backupSource(dir, stamp = new Date().toISOString().replace(/[:.]/g, '-')) {
  const { replaces } = planSeed(dir);
  if (!replaces.length) return null;
  const out = path.join(dir, 'generated', 'data', 'seed-backup', stamp);
  fs.mkdirSync(out, { recursive: true });
  for (const f of replaces) fs.copyFileSync(path.join(dir, 'source', f), path.join(out, f));
  return out;
}
