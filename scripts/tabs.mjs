#!/usr/bin/env node
// Mode B check: attach to YOUR running Chrome (started with --remote-debugging-port, see README "Attach mode"),
// list the open tabs, and optionally read each one the way a person would: bring it to front, scroll with the mouse
// wheel in uneven steps with pauses, then report what is on the page and whether it looks like job listings.
// Nothing is clicked, typed or submitted. Nothing is written to the workspace.
//   node scripts/tabs.mjs                 list tabs
//   node scripts/tabs.mjs --scroll        list + human-paced scroll + content summary per tab
//   node scripts/tabs.mjs --scroll --json
//   node scripts/tabs.mjs --close-extra [--keep 3] [--dry-run]   keep N tabs per site (default 1), close the rest
import { cdpUrl, connectCdp } from '../browser/launch.mjs';

const args = process.argv.slice(2);
const doScroll = args.includes('--scroll'), json = args.includes('--json');
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JOB_WORDS = /\b(apply|job|jobs|career|careers|position|vacanc|opening|hiring|recruit|engineer|manager|director|salary|requirements|responsibilit)/i;
const JOB_WORDS_ZH = /(職缺|職務|應徵|徵才|工作機會|待遇|薪資|年薪|月薪|面議|工作內容|條件要求|經理|主管|工程師|總監)/;
const SITE_HINTS = [
  [/104\.com\.tw/, '104'], [/1111\.com\.tw/, '1111'], [/cakeresume|cake\.me/, 'Cake'], [/yourator/, 'Yourator'], [/linkedin\.com/, 'LinkedIn'],
  [/greenhouse\.io/, 'Greenhouse'], [/lever\.co/, 'Lever'], [/workday/, 'Workday'], [/indeed\./, 'Indeed'], [/glassdoor/, 'Glassdoor'], [/meet\.jobs/, 'Meet.jobs'],
];
const siteOf = (url) => SITE_HINTS.find(([re]) => re.test(url))?.[1] ?? null;

let browser;
try { browser = await connectCdp({ timeout: 30000 }); }   // many open tabs make the attach slow
catch (e) {
  console.error(`[tabs] cannot reach ${cdpUrl()}: ${e.message.split('\n')[0]}`);
  console.error('[tabs] start your Chrome with --remote-debugging-port=9222 (see README "Attach mode"), then re-run.');
  process.exit(1);
}
const pages = browser.contexts().flatMap((c) => c.pages()).filter((p) => !/^(chrome|devtools|edge):\/\//.test(p.url()));
// --close-extra: keep N tabs per site (default 1; the ones with the shortest paths, usually home or search pages) and close the rest,
// including blank tabs. --dry-run only lists what would be closed. Pages that are not job sites are treated the same way.
if (args.includes('--close-extra')) {
  const dry = args.includes('--dry-run');
  const keepN = Math.max(1, Number(args[args.indexOf('--keep') + 1]) || 1);
  const SECOND_LEVEL = /^(com|co|org|net|gov|edu)\.[a-z]{2}$/;
  const siteKey = (url) => {
    if (!/^https?:/.test(url)) return null;
    const labels = new URL(url).hostname.split('.');
    const tail = labels.slice(-2).join('.');
    return SECOND_LEVEL.test(tail) ? labels.slice(-3).join('.') : tail;
  };
  const bySite = new Map();
  for (const p of pages) {
    const k = siteKey(p.url());
    if (!k) continue;
    if (!bySite.has(k)) bySite.set(k, []);
    bySite.get(k).push({ page: p, len: new URL(p.url()).pathname.length });
  }
  const keepSet = new Set();
  for (const list of bySite.values()) for (const e of list.sort((a, b) => a.len - b.len).slice(0, keepN)) keepSet.add(e.page);
  let closed = 0;
  for (const p of pages) {
    if (keepSet.has(p)) continue;
    console.log(`[tabs] ${dry ? 'would close' : 'closing'}: ${p.url().slice(0, 100)}`);
    if (!dry) { await p.close().catch(() => {}); closed++; }
  }
  console.log(`[tabs] ${dry ? 'would keep' : 'kept'} ${keepSet.size} tab(s), ${dry ? 'would close' : 'closed'} ${dry ? pages.length - keepSet.size : closed}`);
  await browser.close().catch(() => {});
  process.exit(0);
}

const out = [];
for (const [i, page] of pages.entries()) {
  const rec = { index: i + 1, url: page.url(), title: '', site: siteOf(page.url()) };
  try { rec.title = await page.title(); } catch { /* page may be sleeping */ }
  if (doScroll) {
    try {
      await page.bringToFront();
      await sleep(rnd(600, 1400));
      const vp = page.viewportSize() ?? { width: 1280, height: 800 };
      await page.mouse.move(rnd(vp.width * 0.3, vp.width * 0.7), rnd(vp.height * 0.3, vp.height * 0.7), { steps: Math.round(rnd(8, 20)) });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      let y = 0, steps = 0;
      while (y < total - vp.height && steps < 25) {
        const dy = Math.round(rnd(180, 620));
        await page.mouse.wheel(0, dy); y += dy; steps++;
        await sleep(rnd(350, 1100));
        if (Math.random() < 0.15) { await page.mouse.wheel(0, -Math.round(rnd(60, 200))); await sleep(rnd(300, 700)); }  // re-read a bit
        if (Math.random() < 0.2) await page.mouse.move(rnd(vp.width * 0.2, vp.width * 0.8), rnd(vp.height * 0.2, vp.height * 0.8), { steps: Math.round(rnd(6, 15)) });
      }
      await sleep(rnd(500, 1000));
      const info = await page.evaluate(() => {
        const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const heads = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.innerText.trim()).filter(Boolean).slice(0, 25);
        const links = [...document.querySelectorAll('a[href]')].map((a) => ({ t: a.innerText.trim().replace(/\s+/g, ' '), h: a.href })).filter((l) => l.t.length > 3 && l.t.length < 120);
        return { chars: text.length, sample: text.slice(0, 600), heads, links: links.slice(0, 400), scrollHeight: document.documentElement.scrollHeight };
      });
      const jobLinks = info.links.filter((l) => JOB_WORDS.test(l.t) || JOB_WORDS_ZH.test(l.t) || /\/job|\/jobs\/|\/careers?\/|\/positions?\//i.test(l.h));
      const uniq = [...new Map(jobLinks.map((l) => [l.h, l])).values()];
      rec.scrolled = { steps, pageHeight: info.scrollHeight, chars: info.chars };
      rec.headings = info.heads;
      rec.sample = info.sample;
      rec.jobLike = { count: uniq.length, examples: uniq.slice(0, 15).map((l) => l.t) };
      rec.looksLikeJobs = uniq.length >= 5 || (JOB_WORDS_ZH.test(info.sample) && JOB_WORDS.test(info.sample));
    } catch (e) { rec.error = e.message.split('\n')[0]; }
  }
  out.push(rec);
}
await browser.close().catch(() => {});   // detaches only; your Chrome stays open

if (json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`[tabs] ${out.length} tab(s) via ${cdpUrl()}`);
for (const r of out) {
  console.log(`\n[${r.index}] ${r.title || '(no title)'}${r.site ? `  <${r.site}>` : ''}\n    ${r.url}`);
  if (r.error) { console.log(`    error: ${r.error}`); continue; }
  if (r.scrolled) {
    console.log(`    scrolled ${r.scrolled.steps} steps over ${r.scrolled.pageHeight}px, ${r.scrolled.chars} chars of text`);
    if (r.headings.length) console.log(`    headings: ${r.headings.slice(0, 8).join(' | ')}`);
    console.log(`    job-like links: ${r.jobLike.count}${r.jobLike.examples.length ? ' e.g. ' + r.jobLike.examples.slice(0, 6).join(' / ') : ''}`);
    console.log(`    verdict: ${r.looksLikeJobs ? 'job listings present' : 'no job listings detected'}`);
  }
}
