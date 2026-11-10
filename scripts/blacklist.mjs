#!/usr/bin/env node
// Blacklist preview and sweep.
//   node scripts/blacklist.mjs            preview: every company name in pipeline.md and discover-audit.tsv that each
//                                         rule in source/blacklist.yml would ban. A keyword hitting several names is flagged.
//   node scripts/blacklist.mjs --apply    move open pre-submit rows that match to skip (status-log reason "blacklist ...").
//                                         Rows already submitted or later are history and stay as they are.
import fs from 'node:fs';
import { loadConfig } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { blacklistReason } from '../lib/blacklist.mjs';
import { canTransition } from '../lib/state.mjs';

const apply = process.argv.includes('--apply');
const bl = loadConfig('blacklist');
const pipeline = readPipeline();

// Distinct company names seen so far, with where they came from.
const seen = new Map();
const add = (name, where) => { if (name) (seen.get(name) ?? seen.set(name, new Set()).get(name)).add(where); };
for (const r of pipeline.rows) add(r.company, 'pipeline');
const audit = P.data('discover-audit.tsv');
if (fs.existsSync(audit)) for (const line of fs.readFileSync(audit, 'utf8').split(/\r?\n/).slice(1)) add(line.split('\t')[2], 'audit');

// Company rules only; title and URL rules are about postings, not employers.
const companyOnly = { companies: bl.companies, company_keywords: bl.company_keywords };
const byRule = new Map();
for (const name of seen.keys()) {
  const why = blacklistReason({ company: name }, companyOnly);
  if (why) (byRule.get(why) ?? byRule.set(why, []).get(why)).push(name);
}
console.log(`[blacklist] ${seen.size} distinct company names checked (pipeline.md + discover-audit.tsv)`);
const rules = [...(bl.companies ?? []).map((c) => `company:${c}`), ...(bl.company_keywords ?? []).map((e) => `company~:${typeof e === 'string' ? e : e?.keyword}`)];
for (const rule of rules) {
  const names = byRule.get(rule) ?? [];
  const flag = rule.startsWith('company~:') && names.length > 1 ? '  ← several names: check none is a different employer (add `except:`)' : '';
  console.log(`  ${rule}  →  ${names.length ? names.join(' / ') : '(no match yet)'}${flag}`);
}

// Open rows the blacklist now covers.
const hits = pipeline.rows.filter((r) => canTransition(r.state, 'skip') && blacklistReason(r, bl));
console.log(`[blacklist] open pre-submit rows matching: ${hits.length}`);
for (const r of hits) console.log(`  ${r.state.padEnd(11)} ${r.report?.slice(0, 3) || '-  '}  ${r.company} — ${r.title}  (${blacklistReason(r, bl)})`);
if (!hits.length) process.exit(0);
if (!apply) { console.log('[blacklist] preview only. Run with --apply to move these rows to skip.'); process.exit(0); }
for (const r of hits) transition(r, 'skip', `blacklist ${blacklistReason(r, bl)}`);
writePipeline(pipeline);
console.log(`[blacklist] moved ${hits.length} row(s) to skip`);
