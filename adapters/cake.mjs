// Cake (cake.me) job search. Cloudflare rejects plain HTTP clients, so everything runs inside a tab of the Chrome you started
// yourself (attach: cdp); the tab is closed at the end and your browser is never closed. Discovery and scoring only.
//   search: POST https://api.cake.me/api/client/v2/jobs/search  { query, filters:{ job_source, locations, ... }, sort_by, page, per_page }
//           the page's own scripts attach a bearer token to every api.cake.me call; this adapter reuses that header from the tab
//   detail: the job page https://www.cake.me/companies/<company>/jobs/<job> carries a JSON-LD JobPosting
import { openTab as openCdpTab } from '../lib/cdp.mjs';
import { politeDelay } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';
import { onShutdown } from '../lib/shutdown.mjs';

export const name = 'cake';
const ORIGIN = 'https://www.cake.me';
const API = 'https://api.cake.me/api/client/v2/jobs/search';

export const jobUrl = (r) => `${ORIGIN}/companies/${r.page?.path}/jobs/${r.path}`;
export const pathOf = (url) => String(url).match(/\/companies\/([^/]+)\/jobs\/([^/?#]+)/)?.slice(1) ?? null;

export function salaryText(s) {
  if (!s || (!s.min && !s.max)) return '';
  const unit = { per_month: '月薪', per_year: '年薪', per_hour: '時薪' }[s.type] ?? s.type ?? '';
  return `${unit} ${s.min ?? '?'}~${s.max ?? '?'} ${s.currency ?? ''}`.trim();
}

/** JSON-LD baseSalary ({ currency, value: { minValue, maxValue, unitText: MONTH|YEAR|HOUR } }) as the same text salaryText gives. */
export function salaryFromLd(b) {
  const v = b?.value ?? {};
  const type = { MONTH: 'per_month', YEAR: 'per_year', HOUR: 'per_hour' }[String(v.unitText ?? '').toUpperCase()] ?? String(v.unitText ?? '').toLowerCase();
  const min = v.minValue ?? v.value ?? null, max = v.maxValue ?? null;
  // A single figure (min = max, often exactly the NT$40,000 legal floor) is read as a floor.
  if (max == null || max === min) return min == null ? '' : salaryText({ min, max: min, currency: b?.currency, type }).replace(/~\S+/, '以上');
  return salaryText({ min, max, currency: b?.currency, type });
}

export const toJob = (r) => ({
  url: jobUrl(r),
  company: r.page?.name ?? '',
  title: r.title,
  source: name,
  location: (r.locations ?? []).join('; '),
  salary: salaryText(r.salary),
  posted: String(r.content_updated_at ?? '').slice(0, 10),
  external_id: `cake:${r.path}`,
});

/** The JobPosting object from a page's JSON-LD blocks, or null. */
export function parseJobPosting(blocks) {
  for (const b of blocks ?? []) {
    try {
      const j = JSON.parse(b);
      const hit = [].concat(j, j?.['@graph'] ?? []).find((x) => x?.['@type'] === 'JobPosting');
      if (hit) return hit;
    } catch { /* next block */ }
  }
  return null;
}

let tab = null;
// Raw CDP tab in your attached Chrome (lib/cdp.mjs); the search API wants the Authorization header the page itself sends.
async function openTab() {
  if (tab) return tab;
  const t = await openCdpTab();
  tab = { cdp: t, auth: null };
  onShutdown(async () => { await t.close(); tab = null; });
  return tab;
}

async function authorised() {
  const t = await openTab();
  if (!t.auth) {
    await t.cdp.navigate(`${ORIGIN}/jobs`, { waitMs: 3000 });
    for (let i = 0; i < 30 && !t.auth; i++) {
      const r = t.cdp.requests().find((x) => /api.cake.me/.test(x.url) && (x.headers.authorization || x.headers.Authorization));
      if (r) t.auth = r.headers.authorization || r.headers.Authorization; else await t.cdp.sleep(500);
    }
  }
  if (!t.auth) throw new Error('cake: no api.cake.me request seen in the tab; open https://www.cake.me/jobs in your Chrome and retry');
  return t;
}

async function query(t, body) {
  return t.cdp.evaluate(`(async () => { const r = await fetch(${JSON.stringify(API)}, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: ${JSON.stringify(t.auth)} }, body: ${JSON.stringify(JSON.stringify(body))} }); return { status: r.status, json: await r.json().catch(() => null) }; })()`);
}

export async function search(cfg = {}) {
  const t = await authorised();
  const seen = new Map();
  const perPage = cfg.per_page ?? 20;
  for (const keyword of cfg.keywords?.length ? cfg.keywords : ['']) {
    for (let page = 1; page <= (cfg.max_pages ?? 3); page++) {
      const body = { query: keyword, filters: { job_source: ['cake', 'external'], ...(cfg.locations?.length ? { locations: cfg.locations } : {}), ...(cfg.filters ?? {}) }, sort_by: cfg.sort_by ?? 'popularity', page, per_page: perPage };
      const { status, json } = await query(t, body);
      if (status !== 200 || !json?.data) throw new Error(`cake search "${keyword}" page ${page}: HTTP ${status}`);
      for (const r of json.data) if (!seen.has(r.path)) seen.set(r.path, toJob(r));
      await politeDelay();
      if (page >= (json.total_pages ?? 1)) break;
    }
  }
  return [...seen.values()];
}

export async function detail(url) {
  if (!pathOf(url)) throw new Error(`cake: cannot parse company and job from ${url}`);
  const t = await openTab();
  await t.cdp.navigate(url, { waitMs: 3500 });
  const blocks = await t.cdp.evaluate(`[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent)`);
  if (!blocks.length) return null;   // a removed posting has no JobPosting JSON-LD
  const j = parseJobPosting(blocks);
  if (!j) return null;
  const loc = [].concat(j.jobLocation ?? []).map((l) => [l.address?.addressRegion, l.address?.addressLocality].filter(Boolean).join(' ')).filter(Boolean).join('; ');
  return {
    url, company: j.hiringOrganization?.name ?? '', title: j.title, source: name, location: loc, salary: salaryFromLd(j.baseSalary),
    posted: String(j.datePosted ?? '').slice(0, 10), external_id: `cake:${pathOf(url)[1]}`,
    description: htmlToText(String(j.description ?? '')),
    meta: { employmentType: j.employmentType ?? null, validThrough: j.validThrough ?? null },
  };
}

export async function isLive(url) { return (await detail(url)) !== null; }
