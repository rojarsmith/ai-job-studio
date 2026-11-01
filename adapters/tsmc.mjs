// TSMC Careers (careers.tsmc.com), an Avature site behind a Cloudflare check: Node's fetch gets "Just a moment", so
// lib/http.mjs falls back to a page fetch in your Chrome (attach: cdp uses the Chrome you started yourself).
//   list:   /en_US/careers/SearchJobs/?<filters>&listFilterMode=true&jobRecordsPerPage=10&jobOffset=<n>   (10 per page, fixed)
//   detail: /en_US/careers/JobDetail?jobId=<id>
// Discovery and scoring only; applying and profile edits are manual (see docs/sites/tsmc.md).
import { fetchText, HttpError, politeDelay } from '../lib/http.mjs';
import { htmlToText, decodeEntities } from '../lib/html.mjs';

export const name = 'tsmc';
const BASE = 'https://careers.tsmc.com/en_US/careers';
export const PAGE_SIZE = 10;

// Filter option ids as published in the search form (names are matched case-insensitively; numbers pass through).
const OPTIONS = {
  org: ['4177', { 'tsmc group': 5410262, esmc: 5410263, jasm: 5410264 }],
  location: ['1277', { taiwan: 13209, canada: 13210, china: 13211, 'germany-dresden': 2326764, 'germany-munich': 4762540, 'japan-yokohama': 13214, 'japan-osaka': 13215, 'japan-tsukuba': 13216, 'japan-kumamoto': 13217, korea: 13212, netherlands: 13213, 'usa-arizona': 13221, 'usa-california': 13218, 'usa-massachusetts': 13219, 'usa-texas': 13220, 'usa-washington': 13222, 'usa-washington, d.c.': 13223 }],
  category: ['558', { 'r&d': 38617, 'specialty technology': 38618, 'ic design technology': 38619, 'manufacturing (fabs)': 38620, 'facility & industrial safety / environmental protection': 38621, 'product development': 38622, 'r&d advanced packaging technology development': 38623, 'testing development and technology': 38635, 'quality and reliability': 38624, 'information technology': 38625, 'internal audit': 38626, 'business development': 38627, 'customer service': 38628, 'corporate planning': 38629, 'finance / accounting / risk management': 38630, 'human resources': 38631, legal: 38632, 'materials management': 38633, 'corporate sustainability (esg)': 7898835, administration: 38634, 'accessibility inclusion': 38636 }],
  job_type: ['147', { technician: 5710, 'associate engineer / admin': 39075, 'engineer / admin': 5709, 'manager / executive': 5708, others: 39076 }],
  employment: ['542', { regular: 5701, temporary: 5702, intern: 13100, apprenticeship: 4348108 }],
};
const TALENT_POOL = /Register your profile on TSMC Talent Pool/i;   // a standing sign-up posting, not a job

/** { location: 'Taiwan', job_type: 'Manager / Executive', keyword: 'director' } → URL query string. */
export function buildQuery(q = {}, offset = 0) {
  const p = new URLSearchParams();
  for (const [key, [param, table]] of Object.entries(OPTIONS)) {
    if (q[key] === undefined || q[key] === '') continue;
    const id = /^\d+$/.test(String(q[key])) ? String(q[key]) : table[String(q[key]).toLowerCase()];
    if (!id) throw new Error(`tsmc: unknown ${key} "${q[key]}" (known: ${Object.keys(table).join(', ')})`);
    p.set(param, id);
  }
  if (q.keyword) p.set('search', q.keyword);
  p.set('listFilterMode', 'true');
  p.set('jobRecordsPerPage', String(PAGE_SIZE));
  p.set('jobOffset', String(offset));
  return p.toString();
}

const text = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Posted: Sep 11, 2026" → "2026-09-11". Built from the parts: Date.parse + toISOString shifts the day in UTC+8. */
const toIso = (s) => {
  const m = String(s ?? '').match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  const mon = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : '';
};
export const jobUrl = (id) => `${BASE}/JobDetail?jobId=${id}`;

/** One search-result page → { total, jobs[] } (pure; tested against a fixture). */
export function parseSearchPage(html) {
  const total = Number((String(html).match(/(\d[\d,]*)\s+results?/i)?.[1] ?? '').replace(/,/g, '')) || 0;
  const jobs = [];
  for (const block of String(html).split(/<article class="article article--result"/).slice(1)) {
    const id = block.match(/JobDetail\?jobId=(\d+)/)?.[1];
    const title = text(block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    if (!id || !title) continue;
    const span = (cls) => text(block.match(new RegExp(`class="list-item-${cls}"[^>]*>([\\s\\S]*?)</span>`))?.[1]);
    jobs.push({ id, title, location: span('location'), category: span('careerArea'), employment: span('employmentType'), posted: toIso(span('posted')) });
  }
  return { total, jobs };
}

/** One JobDetail page → { title, fields{label:value}, responsibilities, qualifications } or null when it is not a posting. */
export function parseDetailPage(html) {
  const h = String(html);
  if (!/article--details/.test(h)) return null;
  const fields = {};
  const re = /article__content__view__field__label">([\s\S]*?)<\/div>\s*<div class="article__content__view__field__value">([\s\S]*?)<\/div>\s*<\/div>/g;
  for (let m; (m = re.exec(h));) { const k = text(m[1]); if (k && !(k in fields)) fields[k] = m[2]; }
  const title = text(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? h.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
  return { title, fields, responsibilities: htmlToText(fields['Job Responsibilities']), qualifications: htmlToText(fields['Job Qualifications']) };
}

const matchAny = (t, list) => !list?.length || list.some((k) => t.toLowerCase().includes(String(k).toLowerCase()));

/** cfg: { queries: [{location, category, job_type, employment, org, keyword}], keywords: [title substrings], max_pages } */
export async function search(cfg = {}) {
  const queries = cfg.queries?.length ? cfg.queries : [{}];
  const maxPages = cfg.max_pages ?? 15;
  const seen = new Map();
  for (const q of queries) {
    for (let page = 0; page < maxPages; page++) {
      const html = await fetchText(`${BASE}/SearchJobs/?${buildQuery(q, page * PAGE_SIZE)}`);
      const { total, jobs } = parseSearchPage(html);
      for (const j of jobs) if (!seen.has(j.id) && !TALENT_POOL.test(j.title) && matchAny(j.title, cfg.keywords)) seen.set(j.id, j);
      if (jobs.length < PAGE_SIZE || (page + 1) * PAGE_SIZE >= total) break;
      await politeDelay();
    }
    await politeDelay();
  }
  return [...seen.values()].map((j) => ({ url: jobUrl(j.id), company: 'TSMC', title: j.title, source: name, location: j.location, posted: j.posted, external_id: `tsmc:${j.id}`, category: j.category }));
}

export async function detail(url) {
  const id = String(url).match(/jobId=(\d+)/)?.[1];
  if (!id) throw new Error(`tsmc: no jobId in ${url}`);
  let html;
  try { html = await fetchText(jobUrl(id)); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  const d = parseDetailPage(html);
  if (!d?.title) return null;
  const f = (k) => text(d.fields[k]);
  return {
    url: jobUrl(id), company: f('Company') || 'TSMC', title: d.title, source: name,
    location: f('Location'), posted: toIso(f('Posted')), external_id: `tsmc:${id}`,
    description: d.responsibilities,   // qualifications go to `requirements`; the report prints both sections, so do not repeat them here
    requirements: d.qualifications,
    meta: { career_area: f('Career Area'), job_type: f('Job Type'), employment_type: f('Employment Type') },
  };
}

export async function isLive(url) { return (await detail(url)) !== null; }
