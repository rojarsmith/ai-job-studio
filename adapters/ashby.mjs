// Ashby public Job Posting API. No auth, no login.
//   board:  https://api.ashbyhq.com/posting-api/job-board/<board>?includeCompensation=true   (one call returns every posting with its text)
//   job URL: https://jobs.ashbyhq.com/<board>/<uuid>
// The API has no per-job endpoint, so detail() reads the board and picks the posting; a posting that is gone means closed.
import { fetchJson, HttpError, politeDelay } from '../lib/http.mjs';

export const name = 'ashby';
const API = 'https://api.ashbyhq.com/posting-api/job-board';
const JOB_URL = /jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i;

const matchAny = (text, list) => !list?.length || list.some((k) => text.toLowerCase().includes(String(k).toLowerCase()));

export function parseJobUrl(url) {
  const m = String(url).match(JOB_URL);
  return m ? { board: m[1], id: m[2].toLowerCase() } : null;
}

/** Every place a posting can be worked from, as one string: primary location, secondary locations, remote flag. */
export const locationOf = (j) => [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location), j.workplaceType === 'Remote' || j.isRemote ? 'Remote' : null].filter(Boolean).join('; ');

const salaryOf = (j) => j.compensation?.compensationTierSummary ?? j.compensation?.scrapeableCompensationSalarySummary ?? '';

const toJob = (board, j) => ({
  url: j.jobUrl,
  company: board,
  title: j.title,
  source: name,
  location: locationOf(j),
  salary: salaryOf(j),
  posted: (j.publishedAt ?? '').slice(0, 10),
  external_id: `${board}:${j.id}`,
});

async function board(token) {
  try { return (await fetchJson(`${API}/${token}?includeCompensation=true`)).jobs ?? []; }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
}

export async function search(cfg) {
  const out = [];
  for (const token of cfg.boards ?? []) {
    const jobs = await board(token);
    if (jobs === null) { console.error(`[ashby] board "${token}" not found (wrong token?)`); continue; }
    for (const j of jobs) {
      if (j.isListed === false) continue;
      if (!matchAny(j.title, cfg.keywords)) continue;
      if (!matchAny(locationOf(j), cfg.locations)) continue;
      out.push(toJob(token, j));
    }
    await politeDelay();
  }
  return out;
}

export async function detail(url) {
  const p = parseJobUrl(url);
  if (!p) throw new Error(`ashby: cannot parse board/id from ${url}`);
  const jobs = await board(p.board);
  const j = (jobs ?? []).find((x) => String(x.id).toLowerCase() === p.id);
  if (!j) return null;
  return { ...toJob(p.board, j), description: j.descriptionPlain ?? '', meta: { department: j.department ?? null, team: j.team ?? null, employmentType: j.employmentType ?? null } };
}

export async function isLive(url) { return (await detail(url)) !== null; }

// ---- S4 / S5: Ashby boards need no account. The form is on the job's /application page. ----
export const needs_login = false;
export async function login_state() { return 'in'; }
export const login = null;
export function apply_url(job) {
  const p = parseJobUrl(job.url);
  return p ? `https://jobs.ashbyhq.com/${p.board}/${p.id}/application` : job.url;
}
/** Wait for the application form; returns true when a form with a file input or email field is present. */
export async function open_form(page) {
  const sel = 'form:has(input[type="file"]), form:has(input[type="email"]), input[type="email"]';
  try { await page.locator(sel).first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
}
/** Design S5: always wait for the human. Never finds or clicks a submit button. */
export async function submit_gate() { return 'needs_human'; }
export const notes = 'Ashby forms have custom questions and EEO radio groups; every radio/checkbox stays needs_confirmation.';
