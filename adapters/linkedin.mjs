// LinkedIn. Login-free search + detail through the guest endpoints (HTML fragments); Easy Apply through your logged-in
// Chrome. LinkedIn is the most bot-sensitive site in the loop (design section 10): lowest daily cap, headed only,
// lock detection stops everything for 24 h. The guest endpoints rate-limit aggressively (HTTP 429 with a JS wall);
// that is reported as rate-limited, not retried.
//   search: https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=..&location=..&start=N  (25 cards/page)
//   detail: https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>                                           (404 when closed)
import { fetchText, HttpError, RateLimited, politeDelay } from '../lib/http.mjs';
import { htmlToText, decodeEntities } from '../lib/html.mjs';
import { siteConfig, genericLoginState, genericLogin } from '../lib/login.mjs';

export const name = 'linkedin';
const ORIGIN = 'https://www.linkedin.com';
const JOB_ID_RE = /(?:jobs\/view\/(?:[^/?#]*?-)?|jobPosting[:/]|currentJobId=)(\d{6,})/;
export const jobIdOf = (url) => String(url).match(JOB_ID_RE)?.[1] ?? null;
const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const pick = (html, re) => html.match(re)?.[1];

/** Pure: parse the guest search fragment into Job[]. */
export function parseSearchHtml(html) {
  const out = [];
  const cards = String(html).split(/<li\b[^>]*>/i).slice(1);
  for (const card of cards) {
    const id = pick(card, /data-entity-urn="urn:li:jobPosting:(\d+)"/) ?? pick(card, /\/jobs\/view\/[^"?]*?-?(\d{6,})\??/);
    if (!id) continue;
    out.push({
      url: `${ORIGIN}/jobs/view/${id}/`,
      company: clean(pick(card, /class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i) ?? pick(card, /class="[^"]*hidden-nested-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i)),
      title: clean(pick(card, /class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ?? pick(card, /<span class="sr-only">([\s\S]*?)<\/span>/i)),
      source: name,
      location: clean(pick(card, /class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i)),
      posted: pick(card, /datetime="(\d{4}-\d{2}-\d{2})"/) ?? '',
      external_id: `linkedin:${id}`,
    });
  }
  return out;
}
/** Pure: parse the guest job-posting page. */
export function parseDetailHtml(html, id) {
  const h = String(html);
  const title = clean(pick(h, /class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h\d>/i) ?? pick(h, /<title>([\s\S]*?)<\/title>/i)?.split('|')[0]);
  const company = clean(pick(h, /class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ?? pick(h, /class="[^"]*topcard__flavor[^"]*"[^>]*>([\s\S]*?)<\/span>/i));
  const location = clean(pick(h, /class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\/span>/i));
  const desc = pick(h, /class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ?? pick(h, /class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/section>/i) ?? '';
  const criteria = {};
  for (const m of h.matchAll(/class="[^"]*description__job-criteria-subheader[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/gi)) criteria[clean(m[1])] = clean(m[2]);
  const easy = /easy apply|Easy Apply/.test(h) && !/apply-button--external|external-apply/i.test(h);
  return { url: `${ORIGIN}/jobs/view/${id}/`, company, title, source: name, location, posted: pick(h, /datetime="(\d{4}-\d{2}-\d{2})"/) ?? '', external_id: `linkedin:${id}`,
    description: htmlToText(desc), requirements: Object.entries(criteria).map(([k, v]) => `${k}: ${v}`).join('\n'), meta: { ...criteria, easy_apply_hint: easy } };
}

const HDR = { Referer: `${ORIGIN}/jobs/search/`, 'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8' };
export async function search(cfg) {
  const out = [];
  const seen = new Set();
  const maxPages = cfg.max_pages ?? 1;
  for (const keyword of cfg.keywords ?? []) {
    for (const location of cfg.locations?.length ? cfg.locations : ['']) {
      for (let p = 0; p < maxPages; p++) {
        const q = new URLSearchParams({ keywords: keyword, location, start: String(p * 25), ...(cfg.params ?? {}) });
        let html;
        try { html = await fetchText(`${ORIGIN}/jobs-guest/jobs/api/seeMoreJobPostings/search?${q}`, { headers: HDR }); }
        catch (e) {
          if (e instanceof RateLimited || e.status === 429) { console.error(`[linkedin] rate-limited on "${keyword}" ${location}; stopping this source for now`); return out; }
          throw e;
        }
        const jobs = parseSearchHtml(html);
        for (const j of jobs) { if (seen.has(j.external_id)) continue; seen.add(j.external_id); out.push(j); }
        await politeDelay();
        if (jobs.length < 25) break;
      }
    }
  }
  return out;
}
export async function detail(url) {
  const id = jobIdOf(url);
  if (!id) throw new Error(`linkedin: cannot parse job id from ${url}`);
  let html;
  try { html = await fetchText(`${ORIGIN}/jobs-guest/jobs/api/jobPosting/${id}`, { headers: HDR }); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  const d = parseDetailHtml(html, id);
  if (!d.title && !d.description) return null;
  return d;
}
export async function isLive(url) { return (await detail(url)) !== null; }

// ---- S4 / S5 ----
export const needs_login = true;
const SITE = () => siteConfig('linkedin', {
  home_url: `${ORIGIN}/feed/`,
  login_url: `${ORIGIN}/login`,
  login_url_re: 'linkedin\\.com/(login|checkpoint|uas)',
  locked_re: 'account has been restricted|temporarily restricted|unusual activity|we.ve restricted your account',
  challenge_re: 'linkedin\\.com/checkpoint/',
  selectors: {
    logged_in: ['.global-nav__me', 'img.global-nav__me-photo', 'a[href*="/mynetwork/"]'],
    logged_out: ['a[href*="/login"]', '.nav__button-secondary'],
    username: '#username, input[name="session_key"]',
    password: '#password, input[name="session_password"]',
    submit: 'button[type="submit"][data-litms-control-urn], button[type="submit"]',
    totp: 'input[name="pin"], #input__phone_verification_pin, input[autocomplete="one-time-code"]',
    totp_submit: '#two-step-submit-button, button[type="submit"]',
  },
  cookie_names: ['li_at'],
});
export async function login_state(page) { return genericLoginState(page, SITE()); }
export async function login(page, creds) { return genericLogin(page, creds, SITE()); }
export function apply_url(job) { return `${ORIGIN}/jobs/view/${jobIdOf(job.url) ?? ''}/`; }
/** Click "Easy Apply" if present; external "Apply" buttons are reported, never followed automatically. */
export async function open_form(page) {
  const btn = page.locator('.jobs-apply-button, button.jobs-apply-button--top-card, button:has-text("Easy Apply")').first();
  if (!(await btn.isVisible({ timeout: 8000 }).catch(() => false))) return false;
  const label = (await btn.innerText().catch(() => '')).trim();
  if (!/easy apply/i.test(label)) { console.log(`[linkedin] this posting uses external apply ("${label}"); open it yourself and continue in that ATS`); return false; }
  await btn.click();
  try { await page.locator('.jobs-easy-apply-modal, div[role="dialog"]:has(form)').first().waitFor({ state: 'visible', timeout: 10000 }); return true; } catch { return false; }
}
export async function submit_gate() { return 'needs_human'; }
export const multi_step = true;   // Easy Apply pages through Next / Review; apply.mjs rescans after each human "next"
export const notes = 'Headed only. Daily cap thresholds.daily_max.linkedin (default 10). Never click "Submit application".';
