// Fallback for JSON APIs behind Cloudflare that reject Node's TLS fingerprint (104 search API, verified 2026-10-29).
// Launches ONE portable-Chrome context (Patchright, dedicated login-free profile) and performs the request from inside
// a page on the same origin, so TLS, headers and cf_clearance cookie are all Chrome's own. No login state is involved.
import { launchSite } from '../browser/launch.mjs';
import { loadConfig } from './config.mjs';

let shared = null;          // { ctx, page }
let originReady = new Set();

async function get() {
  if (!shared) {
    const headless = process.env.JOB_API_BROWSER_HEADLESS
      ? process.env.JOB_API_BROWSER_HEADLESS !== '0'
      : loadConfig('browser').api_fetch_headless !== false;
    shared = await launchSite('_api', { headless });
    const close = async () => { try { await shared?.ctx.close(); } catch { /* ignore */ } };
    process.once('beforeExit', close);
    process.once('SIGINT', async () => { await close(); process.exit(130); });
  }
  return shared;
}

export const looksLikeChallenge = (status, body) =>
  (status === 403 || status === 503) && /just a moment|cf-chl|challenge-platform|cloudflare/i.test(String(body ?? ''));

export async function fetchJsonViaBrowser(url, { referer, timeoutMs = 30000 } = {}) {
  const { page } = await get();
  const origin = new URL(url).origin;
  const warm = referer ?? `${origin}/`;
  if (!originReady.has(origin) || !page.url().startsWith(origin)) {
    await page.goto(warm, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Give a Cloudflare managed challenge a chance to auto-resolve; the title changes when it does.
    for (let i = 0; i < 10 && /just a moment/i.test(await page.title()); i++) await page.waitForTimeout(1500);
    originReady.add(origin);
  }
  const res = await page.evaluate(async ({ u, t }) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), t);
    try {
      const r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json, text/plain, */*' }, signal: ctrl.signal });
      return { status: r.status, text: await r.text() };
    } finally { clearTimeout(id); }
  }, { u: url, t: timeoutMs });
  if (res.status === 404) { const e = new Error(`HTTP 404 ${url}`); e.status = 404; throw e; }
  if (res.status >= 400) { const e = new Error(`HTTP ${res.status} ${url} (browser)`); e.status = res.status; e.body = res.text.slice(0, 300); throw e; }
  try { return JSON.parse(res.text); } catch { throw new Error(`non-JSON body via browser for ${url}: ${res.text.slice(0, 120)}`); }
}

export async function closeBrowserFetch() { if (shared) { await shared.ctx.close(); shared = null; originReady = new Set(); } }
