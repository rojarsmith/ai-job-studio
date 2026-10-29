#!/usr/bin/env node
// S4 Prepare. Open the site in your Chrome, make sure it is logged in (credentials → auto login, else wait_human),
// save the session snapshot, record data/sessions.tsv. Rows in state "tailored" for that site move to "prepared".
//   node scripts/prepare.mjs <site>            e.g. 104 | linkedin | greenhouse (no-op: no login)
//   node scripts/prepare.mjs --all             every site that has tailored rows
//   node scripts/prepare.mjs <site> --check    only report the login state, no login attempt, no state change
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { adapterFor, ADAPTERS } from '../adapters/index.mjs';
import { openSite, ensureLoggedIn } from '../browser/session.mjs';
import { markVerified } from '../lib/sessions.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const pipeline = readPipeline();
const sites = args.includes('--all')
  ? [...new Set(pipeline.rows.filter((r) => r.state === 'tailored').map((r) => r.source))]
  : args.filter((a) => !a.startsWith('--')).slice(0, 1);
if (!sites.length) { console.error('usage: node scripts/prepare.mjs <site> [--check] | --all'); process.exit(2); }

let failed = 0;
for (const site of sites) {
  const adapter = ADAPTERS[site] ?? adapterFor(site);
  if (!adapter.needs_login) {
    console.log(`[prepare] ${site}: no login required`);
    markVerified(site);
    if (!check) for (const r of pipeline.rows) if (r.state === 'tailored' && r.source === site) transition(r, 'prepared', 'no login needed');
    continue;
  }
  const session = await openSite(site);
  try {
    const home = adapter.home_url ?? (await import('../lib/login.mjs')).siteConfig(site, {}).home_url;
    if (check) {
      if (home) await session.page.goto(home, { waitUntil: 'domcontentloaded' });
      console.log(`[prepare] ${site}: login_state=${await adapter.login_state(session.page)} url=${session.page.url()}`);
      continue;
    }
    const r = await ensureLoggedIn(session, adapter, { url: home });
    console.log(`[prepare] ${site}: logged in (${r.how})`);
    for (const row of pipeline.rows) if (row.state === 'tailored' && row.source === site) transition(row, 'prepared', `login ${r.how}`);
  } catch (e) {
    failed++;
    console.error(`[prepare] ${site}: ${e.message}`);
    for (const row of pipeline.rows) if (row.state === 'tailored' && row.source === site) transition(row, 'needs_human', `prepare: ${e.message.slice(0, 80)}`);
  } finally { await session.close(); }
}
writePipeline(pipeline);
console.log(`[prepare] done sites=${sites.length} failed=${failed}`);
process.exit(failed ? 1 : 0);
