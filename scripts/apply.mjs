#!/usr/bin/env node
// S5 Apply, with you next to the window. Fills text / textarea / select / file fields from applications/NNN/answers.md
// and the PDFs; never touches checkbox, radio, CAPTCHA or any knock-out question; never submits.
//   node scripts/apply.mjs <NNN>               fill, then wait for you to review + submit in the window
//   node scripts/apply.mjs <NNN> --dry-run     open the form, scan + plan only, write filled.json, no typing
// Gates: row state prepared (or tailored for login-free sites), daily caps (thresholds.daily_max), duplicate channel
// in tracker, required fields non-empty after fill. Outcome: state filled → (you type "submitted") → submitted + tracker row.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { loadConfig, nowIso } from '../lib/config.mjs';
import { P } from '../lib/paths.mjs';
import { readPipeline, writePipeline, transition } from '../lib/pipeline.mjs';
import { readReport, writeReport } from '../lib/report.mjs';
import { parseAnswers, mergeAnswers } from '../lib/answers.mjs';
import { scanForm, planFill, fillForm, summarize } from '../lib/form.mjs';
import { addApplication, duplicateChannel, countToday, logApplication } from '../lib/tracker.mjs';
import { setMaterials } from '../lib/tailor.mjs';
import { adapterFor } from '../adapters/index.mjs';
import { openSite, ensureLoggedIn, humanPause } from '../browser/session.mjs';
import { waitHuman } from '../browser/wait-human.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => /^\d{3,}$/.test(a));
const dry = args.includes('--dry-run');
if (!id) { console.error('usage: node scripts/apply.mjs <NNN> [--dry-run]'); process.exit(2); }

const pipeline = readPipeline();
const row = pipeline.rows.find((r) => r.report?.startsWith(`${id}-`));
if (!row) { console.error(`[apply] no pipeline row for ${id}`); process.exit(1); }
const adapter = adapterFor(row.source);
const dir = path.join(P.applications, id);
const th = loadConfig('thresholds');
const okStates = adapter.needs_login ? ['prepared'] : ['tailored', 'prepared'];
if (!okStates.includes(row.state) && !dry) { console.error(`[apply] ${id} is ${row.state}; expected ${okStates.join('|')} (run tailor-apply --ok / prepare first)`); process.exit(1); }

// ---- gates before touching the browser ----
const caps = th.daily_max ?? {};
const n = countToday(row.source);
if (!dry && caps[row.source] !== undefined && n.site >= caps[row.source]) { console.error(`[apply] daily cap for ${row.source} reached (${n.site}/${caps[row.source]})`); process.exit(1); }
if (!dry && caps.total !== undefined && n.total >= caps.total) { console.error(`[apply] total daily cap reached (${n.total}/${caps.total})`); process.exit(1); }
const dup = duplicateChannel({ company: row.company, title: row.title, channel: row.source });
if (dup && !dry) { console.error(`[apply] ${row.company} — ${row.title} already applied via ${dup.channel} on ${dup.applied} (#${dup.id}). Stopping; decide by hand.`); process.exit(1); }
if (!fs.existsSync(P.answers)) { console.error(`[apply] missing ${P.answers} (run tailor-prep once, then fill it)`); process.exit(1); }
const overrideFile = path.join(dir, 'answers.md');
const answers = mergeAnswers(parseAnswers(fs.readFileSync(P.answers, 'utf8')), fs.existsSync(overrideFile) ? parseAnswers(fs.readFileSync(overrideFile, 'utf8')) : {});
// Prefer the ATS-named copies from build-pdf (files.json); thresholds.tailor.upload picks pdf or docx.
const files = {};
const namedFiles = fs.existsSync(path.join(dir, 'files.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'files.json'), 'utf8')) : {};
const uploadExt = (th.tailor ?? {}).upload ?? 'pdf';
for (const [k, kind] of [['resume', 'cv'], ['cover_letter', 'cover']]) {
  for (const f of [namedFiles[`${kind}.${uploadExt}`], namedFiles[`${kind}.pdf`], `${kind}.${uploadExt}`, `${kind}.pdf`]) {
    const p = f && path.join(dir, f); if (p && fs.existsSync(p)) { files[k] = p; break; }
  }
}

// ---- browser ----
const job = { url: row.url, company: row.company, title: row.title };
const session = await openSite(row.source);
let plan = [];
try {
  if (adapter.needs_login) await ensureLoggedIn(session, adapter, { url: adapter.apply_url(job) });
  else await session.page.goto(adapter.apply_url(job), { waitUntil: 'domcontentloaded' });
  await humanPause();
  if (adapter.open_form && !(await adapter.open_form(session.page))) {
    await waitHuman(session.page, `${row.source}: application form not found at ${session.page.url()} — navigate to the form yourself, then press Enter`);
  }
  const fields = await scanForm(session.page);
  plan = planFill(fields, answers, { files });
  console.log(`[apply] ${id} fields=${fields.length} plan=${JSON.stringify(summarize(plan))}`);
  if (!dry) plan = await fillForm(session.page, plan);
  fs.writeFileSync(path.join(dir, 'filled.json'), JSON.stringify({ id, url: session.page.url(), at: nowIso(), dry_run: dry, summary: summarize(plan), fields: plan }, null, 2));

  const needs = plan.filter((e) => e.status === 'needs_confirmation');
  const bad = plan.filter((e) => ['verify_failed', 'error'].includes(e.status));
  const emptyRequired = plan.filter((e) => e.required && !['filled', 'needs_confirmation'].includes(e.status));
  console.log(`[apply] ${id} filled=${plan.filter((e) => e.status === 'filled').length} needs_confirmation=${needs.length} problems=${bad.length} required_unfilled=${emptyRequired.length}`);
  for (const e of needs) console.log(`  [confirm] ${e.label}${e.value ? `  → suggested: ${e.value}` : ''}  (${e.note})`);
  for (const e of bad) console.log(`  [problem] ${e.label}: ${e.status} ${e.note}`);
  for (const e of emptyRequired) console.log(`  [required] ${e.label}: ${e.status} ${e.note}`);

  if (dry) { console.log(`[apply] dry-run: nothing typed, filled.json written`); }
  else {
    transition(row, 'filled', `fields=${plan.length} confirm=${needs.length}`);
    writePipeline(pipeline);
    const gate = await adapter.submit_gate(session.page);
    // Multi-step forms (LinkedIn Easy Apply, Workday): after you click Next in the window, type "next" and the
    // newly visible fields are scanned and filled the same way. "submitted" / "abort" end the loop.
    let answer = '';
    for (let step = 1; ; step++) {
      await waitHuman(session.page, `${row.source}: step ${step} — review the form, answer the ${needs.length} confirmation field(s) yourself${adapter.multi_step ? ', click Next if there is one' : ''}, SUBMIT in the window when done (${gate})`, { prompt: `type  ${adapter.multi_step ? 'next | ' : ''}submitted | abort  then Enter` });
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      answer = (await new Promise((r) => rl.question('> ', r))).trim().toLowerCase(); rl.close();
      if (answer !== 'next') break;
      const more = planFill(await scanForm(session.page), answers, { files });
      const filledMore = await fillForm(session.page, more);
      plan.push(...filledMore.filter((e) => !plan.some((p) => p.key === e.key)));
      needs.length = 0; needs.push(...plan.filter((e) => e.status === 'needs_confirmation'));
      console.log(`[apply] step ${step + 1}: ${JSON.stringify(summarize(filledMore))}`);
      for (const e of filledMore.filter((x) => x.status === 'needs_confirmation')) console.log(`  [confirm] ${e.label}${e.value ? `  → suggested: ${e.value}` : ''}  (${e.note})`);
      fs.writeFileSync(path.join(dir, 'filled.json'), JSON.stringify({ id, url: session.page.url(), at: nowIso(), dry_run: dry, summary: summarize(plan), fields: plan }, null, 2));
    }
    if (answer === 'submitted') {
      transition(row, 'submitted', 'human submitted');
      addApplication({ id, company: row.company, title: row.title, url: row.url, channel: row.source, next: `follow up on +${(th.followup_days ?? [7])[0]}d` });
      logApplication(row.source, row.url);
      const rep = readReport(row.report);
      rep.body = setMaterials(rep.body, (rep.body.match(/## Materials\n\n([\s\S]*?)(?=\n## |\s*$)/)?.[1] ?? '').trim() + `\n- submitted: ${nowIso()} via ${row.source}; filled ${plan.filter((e) => e.status === 'filled').length} fields, ${needs.length} confirmed by hand`);
      rep.front.submitted_at = nowIso();
      writeReport(row.report, rep);
      console.log(`[apply] ${id} → submitted, tracker row added`);
    } else {
      console.log(`[apply] ${id} left in state filled (not submitted)`);
    }
  }
} catch (e) {
  console.error(`[apply] ${id}: ${e.message}`);
  if (!dry && row.state !== 'submitted') { try { transition(row, 'needs_human', e.message.slice(0, 80)); } catch { /* already terminal */ } }
  process.exitCode = 1;
} finally {
  writePipeline(pipeline);
  await session.close();
}
