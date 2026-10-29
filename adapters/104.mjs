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
