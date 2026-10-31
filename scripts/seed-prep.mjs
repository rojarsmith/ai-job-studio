#!/usr/bin/env node
// Step 1 of seeding source/ from original/ (no LLM). Lists what the seed mode may read, warns when original/ is not
// locked, and backs up the source/cv*.md that the mode is about to overwrite. Then run modes/seed.md.
//   node scripts/seed-prep.mjs [--no-backup]
import { WS } from '../lib/paths.mjs';
import { planSeed, backupSource } from '../lib/seed.mjs';

const plan = planSeed(WS);
if (!plan.readable.length) { console.error('[seed] original/ has no .md/.txt files; put your hand-written CV there first'); process.exit(1); }
console.log(`[seed] workspace: ${WS}`);
console.log('[seed] input (read only):\n  ' + plan.readable.map((f) => `original/${f}`).join('\n  '));
if (plan.other.length) console.log('[seed] ignored (not text; convert to .md or .txt first):\n  ' + plan.other.map((f) => `original/${f}`).join('\n  '));
if (plan.lock.unlocked.length || plan.lock.changed.length) console.error('[seed] warning: original/ is not fully locked (node scripts/workspace.mjs lock)');
console.log(plan.replaces.length ? '[seed] will OVERWRITE:\n  ' + plan.replaces.map((f) => `source/${f}`).join('\n  ') : '[seed] will create source/cv.md');
if (plan.replaces.length && !process.argv.includes('--no-backup')) console.log(`[seed] backed up to ${backupSource(WS)}`);
console.log('[seed] next: run modes/seed.md, then: node scripts/ats-check.mjs --file <workspace>/source/cv.md');
