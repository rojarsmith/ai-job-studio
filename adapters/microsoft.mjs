// Microsoft Careers (apply.careers.microsoft.com, an Eightfold site). The job search and detail endpoints are the site's own
// JSON API, called from inside a tab of the Chrome you attached (README "Attach mode") because they want the page's CSRF
// token and your session. Needs a profile on the site (the first visit after login asks you to create one).
//   search: /api/pcsx/search?domain=microsoft.com&query=<q>&location=<loc>&start=<n>&sort_by=relevance&filter_include_remote=1   (10 per page)
//   detail: /api/pcsx/position_details?position_id=<id>&domain=microsoft.com&hl=en
//   job URL: https://apply.careers.microsoft.com/careers/job/<id>
// Discovery and scoring. Applying goes through the site's own multi-step form (see docs/sites/microsoft.md).
import { openTab } from '../lib/cdp.mjs';
import { htmlToText } from '../lib/html.mjs';
import { politeDelay } from '../lib/http.mjs';
import { onShutdown } from '../lib/shutdown.mjs';

export const name = 'microsoft';
export const COMPANY = 'Microsoft';
const ORIGIN = 'https://apply.careers.microsoft.com';
export const PAGE_SIZE = 10;
const JOB_URL = /apply\.careers\.microsoft\.com\/careers\/job\/(\d+)/;

export const jobIdOf = (url) => String(url).match(JOB_URL)?.[1] ?? null;

let shared = null;   // { tab, token }
async function session() {
  if (shared) return shared;
  const tab = await openTab(`${ORIGIN}/careers?query=&location=Taiwan&start=0`);
  for (let i = 0; i < 10 && !tab.requests().some((r) => /\/api\/pcsx\//.test(r.url)); i++) await tab.sleep(1000);
  const req = tab.requests().find((r) => /\/api\/pcsx\//.test(r.url) && (r.headers['X-CSRF-Token'] || r.headers['x-csrf-token']));
  if (!req) { await tab.close(); throw new Error('microsoft: the careers page made no API call (not logged in, or the profile dialog is open); open it in your Chrome first'); }
  shared = { tab, token: req.headers['X-CSRF-Token'] ?? req.headers['x-csrf-token'] };
  onShutdown(closeSession);   // discover / score-prep call shutdown() at the end, which closes the tab this run opened
  return shared;
}
export async function closeSession() { if (shared) { await shared.tab.close(); shared = null; } }

async function api(path) {
  const { tab, token } = await session();
  const r = await tab.evaluate(`(async () => { const r = await fetch(${JSON.stringify(ORIGIN + path)}, { credentials: 'include', headers: { 'X-CSRF-Token': ${JSON.stringify(token)}, 'X-Browser-Request-Time': String(Date.now() / 1000), accept: 'application/json' } }); return { status: r.status, text: await r.text() }; })()`);
  if (r.status >= 400) throw new Error(`microsoft: HTTP ${r.status} ${path}`);
  const j = JSON.parse(r.text);
  if (j.status && j.status >= 400) throw new Error(`microsoft: ${j.status} ${j.error?.message ?? ''} ${path}`);
  return j.data ?? j;
}

const toJob = (p) => ({
  url: p.publicUrl ?? `${ORIGIN}${p.positionUrl ?? `/careers/job/${p.id}`}`,
  company: COMPANY,
  title: p.name,
  source: name,
  location: (p.locations ?? []).join('; ') + (p.workLocationOption && p.workLocationOption !== 'onsite' ? ` (${p.workLocationOption})` : ''),
  salary: '',
  posted: p.postedTs ? new Date(p.postedTs * 1000).toISOString().slice(0, 10) : '',
  external_id: `microsoft:${p.id}`,
});

/** cfg: { keywords: [...], locations: ['Taiwan', 'Tokyo, Japan', ...], max_pages, include_remote } */
export async function search(cfg) {
  const seen = new Map();
  const keywords = cfg.keywords?.length ? cfg.keywords : [''];
  const remote = cfg.include_remote === false ? 0 : 1;
  for (const loc of cfg.locations ?? ['']) {
    for (const q of keywords) {
      for (let page = 0; page < (cfg.max_pages ?? 3); page++) {
        const d = await api(`/api/pcsx/search?domain=microsoft.com&query=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}&start=${page * PAGE_SIZE}&sort_by=relevance&filter_include_remote=${remote}`);
        const list = d.positions ?? [];
        for (const p of list) if (!seen.has(p.id)) seen.set(p.id, toJob(p));
        if (list.length < PAGE_SIZE || (page + 1) * PAGE_SIZE >= (d.count ?? 0)) break;
        await politeDelay();
      }
      await politeDelay();
    }
  }
  return [...seen.values()];
}

export async function detail(url) {
  const id = jobIdOf(url);
  if (!id) throw new Error(`microsoft: cannot parse job id from ${url}`);
  let d;
  try { d = await api(`/api/pcsx/position_details?position_id=${id}&domain=microsoft.com&hl=en`); }
  catch (e) { if (/HTTP 404|\b404\b/.test(e.message)) return null; throw e; }
  if (!d || !d.name) return null;
  const meta = {
    roletype: d.efcustomTextRoletype?.[0] ?? null,
    worksite: d.efcustomTextWorkSite?.[0] ?? null,
    profession: d.efcustomTextCurrentProfession?.[0] ?? null,
    discipline: d.efcustomTextTaDisciplineName?.[0] ?? null,
    employment: d.efcustomTextEmploymentType?.[0] ?? null,
    travel: d.efcustomTextRequiredTravel?.[0] ?? null,
    department: d.department ?? null,
    jobNumber: d.displayJobId ?? d.atsJobId ?? null,
  };
  return { ...toJob(d), description: htmlToText(d.jobDescription ?? ''), meta };
}

export async function isLive(url) { return (await detail(url)) !== null; }

// ---- S4 / S5: the person logs in by hand; the form is the site's own multi-step apply flow. ----
export const needs_login = true;
export async function login_state() { try { await session(); return 'in'; } catch { return 'out'; } }
export const login = null;
export function apply_url(job) { return job.url; }
export async function open_form() { return false; }
export async function submit_gate() { return 'needs_human'; }
export const multi_step = true;
export const notes = 'Microsoft (Eightfold): discovery and scoring through the site API in your Chrome; the apply form is multi-step with work-authorization questions that stay needs_confirmation.';
