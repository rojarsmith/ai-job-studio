#!/usr/bin/env node
// Manage the private workspace.
//   node scripts/workspace.mjs init  [--workspace <dir>] [--from-git <url>]   create / complete from examples/
//   node scripts/workspace.mjs path                                           print resolved workspace path
//   node scripts/workspace.mjs check                                          diagnose layout and git safety
import { resolveWorkspace, initWorkspace, checkWorkspace } from '../lib/workspace.mjs';

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--workspace' && args[args.indexOf(a) - 1] !== '--from-git') ?? 'path';
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const { dir, via } = resolveWorkspace({ argv: args });

if (cmd === 'path') {
  console.log(dir);
  console.error(`(resolved via ${via})`);
} else if (cmd === 'init') {
  initWorkspace(dir, { fromGit: opt('--from-git') });
  console.log(`[workspace] ready: ${dir} (via ${via})`);
  const r = checkWorkspace(dir);
  for (const n of r.notes) console.log(`[workspace] note: ${n}`);
  for (const p of r.problems) console.error(`[workspace] problem: ${p}`);
  console.log('[workspace] next: edit config/profile.yml, config/portals.yml, cv.md');
} else if (cmd === 'check') {
  const r = checkWorkspace(dir);
  console.log(`[workspace] ${dir} (via ${via})`);
  for (const n of r.notes) console.log(`[workspace] note: ${n}`);
  for (const p of r.problems) console.error(`[workspace] problem: ${p}`);
  console.log(r.ok ? '[workspace] OK' : '[workspace] NOT OK');
  process.exit(r.ok ? 0 : 1);
} else {
  console.error('usage: node scripts/workspace.mjs <init|path|check> [--workspace <dir>] [--from-git <url>]');
  process.exit(2);
}
