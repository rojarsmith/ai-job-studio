// 104.com.tw login-free JSON API (verified 2026-10-29: plain fetch with Referer works; no TLS impersonation needed).
//   search: https://www.104.com.tw/jobs/search/api/jobs?keyword=..&area=..&page=..&pagesize=..   (Referer: /jobs/search/)
//   detail: https://www.104.com.tw/job/ajax/content/<jobId>                                        (Referer: /job/<jobId>)
// Closed jobs: detail returns switch !== 'on' or 404.
import { fetchJson, HttpError, politeDelay } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

export const name = '104';
const ORIGIN = 'https://www.104.com.tw';
const JOB_URL = /104\.com\.tw\/job\/([a-z0-9]+)/i;

export const jobIdOf = (url) => String(url).match(JOB_URL)?.[1] ?? null;
const salaryOf = (j) => (j.salaryLow || j.salaryHigh) ? `${j.salaryLow ?? '?'}~${j.salaryHigh ?? '?'}` : (j.salaryDesc ?? '');
const dateOf = (s) => String(s ?? '').replace(/^(\d{4})\/?(\d{2})\/?(\d{2})$/, '$1-$2-$3');

// ---- search by employer ---------------------------------------------------------------------------------------
// The keyword search cannot be limited to an employer (a company name alone returns nothing), but every employer has its own
// job list: company search /company/ajax/list?keyword=<name> gives `encodedCustNo`, and /api/companies/<id>/jobs takes
// page, pageSize and a keyword. `cfg.companies` = { top: 50, from: 1 } (by market cap, lib/toplisted.mjs) and/or { names: [...] },
// plus keywords (title words), max_pages and locations (substring of the job's address).
const normalize = (s) => String(s ?? '').replace(/臺/g, '台').replace(/[（(][^）)]*[）)]/g, '').replace(/股份有限公司|有限公司|公司|[\s　]/g, '').toLowerCase();

/** The company-search result for an employer: same normalised name, else a result whose name starts with it, else null. */
export function pickCompany(results, name) {
  const want = normalize(name);
  const list = results ?? [];
  return list.find((r) => normalize(r.name) === want) ?? list.find((r) => normalize(r.name).startsWith(want)) ?? null;
}

async function resolveCompany(legal) {
  const q = new URLSearchParams({ keyword: legal, features: '1', pageSize: '18' });
  const data = await fetchJson(`${ORIGIN}/company/ajax/list?${q}`, { headers: { Referer: `${ORIGIN}/company/search/` } });
  return pickCompany(data.data, legal);
}

export function companyJobs(data, legal) {
  const lists = data?.data?.list ?? {};
  return [...(lists.topJobs ?? []), ...(lists.normalJobs ?? [])].map((j) => ({
    url: j.jobUrl ?? `${ORIGIN}/job/${j.jobNo}`, company: legal, title: j.jobName, source: name,
    location: j.jobAddrNoDesc ?? '', salary: j.jobSalaryDesc ?? '', posted: '', external_id: `104:${j.jobNo}`,
  }));
}

export async function searchCompanies(cfg) {
  const c = cfg.companies ?? {};
  const targets = [...(c.names ?? [])];
  if (c.top) for (const t of (await (await import('../lib/toplisted.mjs')).topListed(c.top)).slice((c.from ?? 1) - 1)) targets.push(t.legal);
  const out = [];
  const keywords = c.keywords?.length ? c.keywords : [''];
  for (const legal of [...new Set(targets)]) {
    const co = await resolveCompany(legal);
    await politeDelay();
    if (!co) { console.error(`[104] employer not found on 104: ${legal}`); continue; }
    for (const keyword of keywords) {
      for (let page = 1; page <= (c.max_pages ?? 2); page++) {
        const q = new URLSearchParams({ page: String(page), pageSize: '20', ...(keyword ? { keyword } : {}) });
        const data = await fetchJson(`${ORIGIN}/api/companies/${co.encodedCustNo}/jobs?${q}`, { headers: { Referer: `${ORIGIN}/company/${co.encodedCustNo}` } });
        for (const j of companyJobs(data, legal)) if (!c.locations?.length || c.locations.some((l) => j.location.includes(l))) out.push(j);
        await politeDelay();
        if (page >= (data?.data?.totalPages ?? 1)) break;
      }
    }
  }
  return out;
}

export async function search(cfg) {
  const out = [];
  const seen = new Set();
  if (cfg.companies) for (const j of await searchCompanies(cfg)) { const id = jobIdOf(j.url); if (!seen.has(id)) { seen.add(id); out.push(j); } }
  if (!cfg.keywords?.length) return out;
  const pagesize = cfg.pagesize ?? 20;
  const maxPages = cfg.max_pages ?? 1;
  const extra = cfg.params ?? {};
  for (const keyword of cfg.keywords ?? []) {
    for (const area of cfg.areas?.length ? cfg.areas : ['']) {
      for (let page = 1; page <= maxPages; page++) {
        const q = new URLSearchParams({ jobsource: 'index_s', mode: 's', keyword, page: String(page), pagesize: String(pagesize), ...(area ? { area: String(area) } : {}) });
        for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
        const data = await fetchJson(`${ORIGIN}/jobs/search/api/jobs?${q}`, { headers: { Referer: `${ORIGIN}/jobs/search/` } });
        const list = Array.isArray(data.data) ? data.data : data.data?.list ?? [];
        for (const j of list) {
          const url = j.link?.job ? j.link.job.replace(/^\/\//, 'https://') : `${ORIGIN}/job/${j.jobNo}`;
          const id = jobIdOf(url) ?? j.jobNo;
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            url, company: j.custName, title: j.jobName, source: name,
            location: j.jobAddrNoDesc ?? '', salary: salaryOf(j), posted: dateOf(j.appearDate), external_id: `104:${id}`,
          });
        }
        await politeDelay();
        const last = data.metadata?.pagination?.lastPage ?? 1;
        if (page >= last || list.length < pagesize) break;
      }
    }
  }
  return out;
}

export async function detail(url) {
  const id = jobIdOf(url);
  if (!id) throw new Error(`104: cannot parse job id from ${url}`);
  let d;
  try { d = (await fetchJson(`${ORIGIN}/job/ajax/content/${id}`, { headers: { Referer: `${ORIGIN}/job/${id}` } })).data; }
  catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  if (!d || (d.switch && d.switch !== 'on')) return null;
  const h = d.header ?? {}, jd = d.jobDetail ?? {}, c = d.condition ?? {};
  const list = (arr, key = 'description') => (arr ?? []).map((x) => (typeof x === 'string' ? x : x?.[key])).filter(Boolean).join(', ');
  const requirements = [
    c.workExp && `工作經歷: ${c.workExp}`, c.edu && `學歷: ${c.edu}`,
    c.major?.length && `科系: ${list(c.major)}`, c.language?.length && `語文: ${list(c.language)}`,
    c.skill?.length && `技能: ${list(c.skill)}`, c.specialty?.length && `擅長工具: ${list(c.specialty)}`,
    c.certificate?.length && `證照: ${list(c.certificate)}`, c.other && `其他條件:\n${c.other}`,
  ].filter(Boolean).join('\n');
  return {
    url: `${ORIGIN}/job/${id}`, company: h.custName, title: h.jobName, source: name,
    location: [jd.addressRegion, jd.addressDetail].filter(Boolean).join(' '),
    salary: jd.salary ?? '', posted: dateOf(h.appearDate), external_id: `104:${id}`,
    description: htmlToText(jd.jobDescription),
    requirements,
    meta: {
      category: list(jd.jobCategory), jobType: jd.jobType, workType: list(jd.workType), remote: jd.remoteWork ?? null,
      manageResp: jd.manageResp, businessTrip: jd.businessTrip, workPeriod: jd.workPeriod, needEmp: jd.needEmp,
      welfare: typeof d.welfare?.welfare === 'string' ? htmlToText(d.welfare.welfare).slice(0, 1500) : '',
      employees: d.employees, industry: d.industry, closeDate: d.closeDate ?? null,
    },
  };
}

export async function isLive(url) { return (await detail(url)) !== null; }

// ---- S4 / S5: 104 needs a member login. Selectors below are defaults; override in <workspace>/config/sites.yml
// under "104" if the site changes. UNVERIFIED against the live site as of 2026-10-29. ----
import { siteConfig, genericLoginState, genericLogin } from '../lib/login.mjs';
export const needs_login = true;
const SITE = () => siteConfig('104', {
  home_url: 'https://www.104.com.tw/jobs/main/',
  login_url: 'https://accounts.104.com.tw/login',
  login_url_re: 'accounts\\.104\\.com\\.tw',
  apply_url_template: 'https://www.104.com.tw/job/{id}',   // no apply page: 應徵 on the job page opens a modal (?apply=form)
  locked_re: '帳號(已)?(被)?(鎖定|停用)|異常(登入|活動)|unusual activity',
  selectors: {
    logged_in: ['a[href*="logout"]', 'a[href*="/profile"]', 'text=登出', 'a:has-text("前往履歷表")', 'a[href*="cweb_job_login"]', 'text=履歷符合度'],   // home page / job page
    logged_out: ['a[href*="accounts.104.com.tw/login"]', 'text=登入'],
    username: '#username, input[name="username"], input[name="email"], input[type="email"], input[name*="user" i]',
    password: '#password, input[name="password"], input[type="password"]',
    submit: 'button[type="submit"], button:has-text("登入")',
    totp: 'input[name*="otp" i], input[name*="code" i], input[autocomplete="one-time-code"]',
  },
  cookie_names: [],
});
/** Site settings (defaults + source/sites.yml); prepare reads home_url from here. */
export const site_config = () => SITE();
export async function login_state(page) { return genericLoginState(page, SITE()); }
export async function login(page, creds) { return genericLogin(page, creds, SITE()); }
export function apply_url(job) { return SITE().apply_url_template.replace('{id}', jobIdOf(job.url) ?? ''); }
// 應徵 is a <span>, repeated in banners and sticky bars: click the topmost visible one, then wait for the modal's textarea.
// Nothing is sent until 確認送出, which stays with the human.
export async function open_form(page) {
  await page.waitForTimeout(3000);
  if (await page.getByText('今日已應徵').count()) throw new Error('104 shows 今日已應徵: already applied, nothing to fill');
  const spans = page.locator('span').filter({ hasText: /^應徵$/ }).locator('visible=true');
  let best = null, bestY = Infinity;
  for (let i = 0, n = await spans.count(); i < n; i++) { const b = await spans.nth(i).boundingBox(); if (b && b.y < bestY) { bestY = b.y; best = spans.nth(i); } }
  if (!best) return false;
  await best.click();
  try { await page.locator('textarea').locator('visible=true').first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
}
// The modal's one textarea is 自我推薦信 (limit 2000 characters); the resume is the 104 online resume, no upload.
export const cover_letter_field = { only_textarea: true, max_chars: 2000 };
export async function submit_gate() { return 'needs_human'; }
export const notes = '104 在職缺頁點「應徵」開出視窗：站內線上履歷 + 自我推薦信 textarea。本工具只把求職信填進推薦信，兩個勾選框與「確認送出」由你操作。';
