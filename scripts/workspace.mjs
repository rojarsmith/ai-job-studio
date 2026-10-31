#!/usr/bin/env node
// Manage the private workspace.
//   node scripts/workspace.mjs init    [--workspace <dir>] [--from-git <url>]   create / complete from examples/
//   node scripts/workspace.mjs path    [original|source|generated|runtime]      print resolved workspace (or tier) path
//   node scripts/workspace.mjs check                                            diagnose layout and git safety
//   node scripts/workspace.mjs lock    [--force]                                hash + make read-only everything in original/
//   node scripts/workspace.mjs migrate [--dry-run]                              move a flat (pre-tier) workspace into original/ source/ generated/ runtime/
import path from 'node:path';
import { resolveWorkspace, initWorkspace, checkWorkspace, migrateWorkspace, lockOriginals, TIERS } from '../lib/workspace.mjs';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !['--workspace', '--from-git'].includes(args[i - 1]));
const cmd = positional[0] ?? 'path';
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const { dir, via } = resolveWorkspace({ argv: args });
const report = (r) => { for (const n of r.notes) console.log(`[workspace] note: ${n}`); for (const p of r.problems) console.error(`[workspace] problem: ${p}`); };

if (cmd === 'path') {
  const tier = positional[1];
  if (tier && !TIERS.includes(tier)) { console.error(`unknown tier ${tier}; one of ${TIERS.join('|')}`); process.exit(2); }
  console.log(tier ? path.join(dir, tier) : dir);
  console.error(`(resolved via ${via})`);
} else if (cmd === 'init') {
  initWorkspace(dir, { fromGit: opt('--from-git') });
  console.log(`[workspace] ready: ${dir} (via ${via})`);
  report(checkWorkspace(dir));
  console.log('[workspace] next: edit source/profile.yml, source/portals.yml, source/cv.md');
} else if (cmd === 'check') {
  const r = checkWorkspace(dir);
  console.log(`[workspace] ${dir} (via ${via})`);
  report(r);
  console.log(r.ok ? '[workspace] OK' : '[workspace] NOT OK');
  process.exit(r.ok ? 0 : 1);
} else if (cmd === 'lock') {
  const r = lockOriginals(dir, { force: args.includes('--force') });
  console.log(`[workspace] locked ${r.locked.length} file(s) in original/ (${r.added.length} new, ${r.accepted.length} changed accepted)`);
} else if (cmd === 'migrate') {
  const dry = args.includes('--dry-run');
  const moves = migrateWorkspace(dir, { dryRun: dry });
  for (const [from, to] of moves) console.log(`[workspace] ${dry ? 'would move' : 'moved'} ${from} -> ${to}`);
  if (!dry) { console.log(`[workspace] migrated ${dir}; .gitignore rewritten`); report(checkWorkspace(dir)); }
} else {
  console.error('usage: node scripts/workspace.mjs <init|path [tier]|check|lock|migrate [--dry-run]> [--workspace <dir>] [--from-git <url>]');
  process.exit(2);
}
