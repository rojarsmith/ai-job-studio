// Fallback for endpoints that reject Node's TLS fingerprint (104 search behind Cloudflare, LinkedIn guest API
// behind a JS wall). Launches ONE Chrome context (Patchright, dedicated login-free profile) and performs the request
// from inside a page on the same origin, so TLS, headers and clearance cookies are all Chrome's own.
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
  (status === 403 || status === 503 || status === 429) && /just a moment|cf-chl|challenge-platform|cloudflare|http-equiv="refresh"|_0x[0-9a-f]{4}/i.test(String(body ?? ''));

/** Returns { status, text }. Throws on 404 so liveness checks keep working. */
export async function fetchViaBrowser(url, { referer, timeoutMs = 30000, accept = '*/*' } = {}) {
  const { page } = await get();
  const origin = new URL(url).origin;
  const warm = referer ?? `${origin}/`;
  if (!originReady.has(origin) || !page.url().startsWith(origin)) {
    await page.goto(warm, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    for (let i = 0; i < 10 && /just a moment/i.test(await page.title()); i++) await page.waitForTimeout(1500);
    originReady.add(origin);
  }
  const res = await page.evaluate(async ({ u, t, a }) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), t);
    try {
      const r = await fetch(u, { credentials: 'include', headers: { Accept: a }, signal: ctrl.signal });
      return { status: r.status, text: await r.text() };
    } finally { clearTimeout(id); }
  }, { u: url, t: timeoutMs, a: accept });
  if (res.status === 404) { const e = new Error(`HTTP 404 ${url}`); e.status = 404; throw e; }
  if (res.status >= 400) { const e = new Error(`HTTP ${res.status} ${url} (browser)`); e.status = res.status; e.body = res.text.slice(0, 300); throw e; }
  return res;
}
export async function fetchJsonViaBrowser(url, opts = {}) {
  const r = await fetchViaBrowser(url, { ...opts, accept: 'application/json, text/plain, */*' });
  try { return JSON.parse(r.text); } catch { throw new Error(`non-JSON body via browser for ${url}: ${r.text.slice(0, 120)}`); }
}
export async function closeBrowserFetch() { if (shared) { await shared.ctx.close(); shared = null; originReady = new Set(); } }
