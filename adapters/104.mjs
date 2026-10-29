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

export async function search(cfg) {
  const out = [];
  const seen = new Set();
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
  apply_url_template: 'https://www.104.com.tw/job/{id}/apply',
  locked_re: '帳號(已)?(被)?(鎖定|停用)|異常(登入|活動)|unusual activity',
  selectors: {
    logged_in: ['a[href*="logout"]', 'a[href*="/profile"]', 'text=登出'],
    logged_out: ['a[href*="accounts.104.com.tw/login"]', 'text=登入'],
    username: '#username, input[name="username"], input[name="email"], input[type="email"], input[name*="user" i]',
    password: '#password, input[name="password"], input[type="password"]',
    submit: 'button[type="submit"], button:has-text("登入")',
    totp: 'input[name*="otp" i], input[name*="code" i], input[autocomplete="one-time-code"]',
  },
  cookie_names: [],
});
export async function login_state(page) { return genericLoginState(page, SITE()); }
export async function login(page, creds) { return genericLogin(page, creds, SITE()); }
export function apply_url(job) { return SITE().apply_url_template.replace('{id}', jobIdOf(job.url) ?? ''); }
export async function open_form(page) {
  try { await page.locator('form:has(textarea), form:has(input[type="file"]), form').first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
}
export async function submit_gate() { return 'needs_human'; }
export const notes = '104 應徵頁通常帶出站內履歷與自我推薦信 textarea；本工具只填 textarea 與文字欄位，附件與送出由你操作。';
