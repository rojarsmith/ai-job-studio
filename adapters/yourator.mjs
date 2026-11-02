// Yourator (yourator.co) public job search. No auth, no login. Discovery and scoring only; applying stays with the person.
//   list:   https://www.yourator.co/api/v4/jobs?term[]=<keyword>&page=<n>&sort=recent_updated   (JSON, 20 rows a page, payload.hasMore)
//   detail: the job page https://www.yourator.co/companies/<company>/jobs/<id>, whose JSON-LD `JobPosting` holds the full text
// The list has no description and only a relative "updated" label, so the posted date and text come from the detail page.
import { fetchJson, fetchText, HttpError, politeDelay } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

export const name = 'yourator';
const BASE = 'https://www.yourator.co';

const matchAny = (text, list) => !list?.length || list.some((k) => text.toLowerCase().includes(String(k).toLowerCase()));

export const jobUrl = (path) => (String(path).startsWith('http') ? path : `${BASE}${path}`);
export const jobIdOf = (url) => String(url).match(/\/jobs\/(\d+)/)?.[1] ?? null;

export function buildListUrl(term, page = 1, params = {}) {
  const q = new URLSearchParams();
  if (term) q.append('term[]', term);
  q.set('page', String(page));
  q.set('sort', 'recent_updated');
  for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) q.append(Array.isArray(v) ? `${k}[]` : k, String(x));
  return `${BASE}/api/v4/jobs?${q}`;
}

export const toJob = (j) => ({
  url: jobUrl(j.path),
  company: j.company?.brand ?? '',
  title: j.name,
  source: name,
  location: j.location ?? '',
  salary: j.salary ?? '',
  posted: '',
  external_id: String(j.id),
});

export async function search(cfg = {}) {
  const seen = new Map();
  const terms = cfg.keywords?.length ? cfg.keywords : [''];
  for (const term of terms) {
    for (let page = 1; page <= (cfg.max_pages ?? 3); page++) {
      const d = (await fetchJson(buildListUrl(term, page, cfg.params))).payload ?? {};
      for (const j of d.jobs ?? []) {
        if (!matchAny(j.location ?? '', cfg.locations)) continue;
        if (!seen.has(j.id)) seen.set(j.id, toJob(j));
      }
      await politeDelay();
      if (!d.hasMore) break;
    }
  }
  return [...seen.values()];
}

/** The JobPosting object from a job page's JSON-LD blocks, or null. */
export function parseJobPosting(html) {
  for (const m of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1].trim()); if (j?.['@type'] === 'JobPosting') return j; } catch { /* next block */ }
  }
  return null;
}

/** Text of the page section under the given heading (`h2.job-heading`), e.g. 條件要求 / Requirement, or ''. */
export function sectionText(html, heading) {
  const re = new RegExp(String.raw`<h2[^>]*job-heading[^>]*>\s*${heading}\s*</h2>\s*<section[^>]*>([\s\S]*?)</section>`);
  const m = String(html).match(re);
  return m ? htmlToText(m[1]) : '';
}

export async function detail(url) {
  let html;
  try { html = await fetchText(url); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  const j = parseJobPosting(html);
  if (!j) return null;
  const addr = j.jobLocation?.address ?? {};
  return {
    url,
    company: j.hiringOrganization?.name ?? '',
    title: j.title,
    source: name,
    location: [addr.addressRegion, addr.addressLocality].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' '),
    salary: '',
    posted: String(j.datePosted ?? '').slice(0, 10),
    external_id: jobIdOf(url) ?? String(j.identifier ?? ''),
    description: htmlToText(String(j.description ?? '')),
    requirements: sectionText(html, '條件要求') || sectionText(html, 'Requirements?'),
    meta: { employmentType: j.employmentType ?? null, validThrough: j.validThrough ?? null },
  };
}

export async function isLive(url) { return (await detail(url)) !== null; }
