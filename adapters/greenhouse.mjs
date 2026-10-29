// Greenhouse public Job Board API. No auth, no login.
//   list:   https://boards-api.greenhouse.io/v1/boards/<board>/jobs?content=false
//   detail: https://boards-api.greenhouse.io/v1/boards/<board>/jobs/<id>   (404 when closed)
import { fetchJson, HttpError, politeDelay } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

export const name = 'greenhouse';
const API = 'https://boards-api.greenhouse.io/v1/boards';
const BOARD_URL = /boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/;
const EMBED_URL = /gh_jid=(\d+)/;

const metaValues = (job) => (job.metadata ?? []).flatMap((m) => (Array.isArray(m.value) ? m.value : [m.value])).filter(Boolean).map(String);
const locationOf = (job) => [job.location?.name, ...(job.offices ?? []).map((o) => o.name), ...metaValues(job)].filter(Boolean).join('; ');
const matchAny = (text, list) => !list?.length || list.some((k) => text.toLowerCase().includes(String(k).toLowerCase()));

export function parseJobUrl(url) {
  const m = String(url).match(BOARD_URL);
  if (m) return { board: m[1], id: m[2] };
  const e = String(url).match(EMBED_URL);
  if (e) return { board: null, id: e[1] };
  return null;
}

export async function search(cfg) {
  const out = [];
  for (const board of cfg.boards ?? []) {
    const data = await fetchJson(`${API}/${board}/jobs?content=false`);
    for (const j of data.jobs ?? []) {
      if (!matchAny(j.title, cfg.keywords)) continue;
      if (!matchAny(locationOf(j), cfg.locations)) continue;
      out.push({
        url: j.absolute_url,
        company: j.company_name || board,
        title: j.title,
        source: name,
        location: j.location?.name ?? '',
        posted: (j.first_published ?? j.updated_at ?? '').slice(0, 10),
        external_id: `${board}:${j.id}`,
      });
    }
    await politeDelay();
  }
  return out;
}

export async function detail(url, { board } = {}) {
  const p = parseJobUrl(url);
  const b = p?.board ?? board;
  if (!p || !b) throw new Error(`greenhouse: cannot parse board/id from ${url}`);
  let j;
  try { j = await fetchJson(`${API}/${b}/jobs/${p.id}`); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  return {
    url: j.absolute_url ?? url,
    company: j.company_name || b,
    title: j.title,
    source: name,
    location: locationOf(j),
    posted: (j.first_published ?? j.updated_at ?? '').slice(0, 10),
    external_id: `${b}:${j.id}`,
    description: htmlToText(j.content),
    meta: { departments: (j.departments ?? []).map((d) => d.name), deadline: j.application_deadline ?? null },
  };
}

export async function isLive(url, opts) { return (await detail(url, opts)) !== null; }

// ---- S4 / S5: Greenhouse boards need no account. The form is on the job page itself. ----
export const needs_login = false;
export async function login_state() { return 'in'; }
export const login = null;
export function apply_url(job) {
  const p = parseJobUrl(job.url);
  return p?.board ? `https://job-boards.greenhouse.io/${p.board}/jobs/${p.id}#app` : job.url;
}
/** Wait for the application form; returns true when a form with a file input or email field is present. */
export async function open_form(page) {
  const sel = 'form[id*="application"], #application_form, form:has(input[type="file"]), form:has(input[type="email"])';
  try { await page.locator(sel).first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
}
/** Design S5: always wait for the human. Never finds or clicks a submit button. */
export async function submit_gate() { return 'needs_human'; }
export const notes = 'Lever-style hCaptcha risk does not apply, but Greenhouse forms may include EEO radio groups and custom questions; all radio/checkbox stay needs_confirmation.';
