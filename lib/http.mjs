// Login-free HTTP with Chrome-like headers, retry and polite jitter.
// No browser here except the challenge fallback (lib/browser-fetch.mjs); L1 proper is only for login-required flows.
import { loadConfig } from './config.mjs';
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function politeDelay() {
  const r = loadConfig('thresholds').rate ?? {};
  const lo = r.min_delay_ms ?? 1500, hi = r.max_delay_ms ?? 4000;
  await sleep(lo + Math.random() * (hi - lo));
}
export class HttpError extends Error {
  constructor(status, url, body) { super(`HTTP ${status} ${url}`); this.status = status; this.url = url; this.body = body; }
}
export class RateLimited extends HttpError {}

let challengeWarned = false;
const looksLikeChallenge = (status, body) =>
  (status === 403 || status === 503 || status === 429) && /just a moment|cf-chl|challenge-platform|cloudflare|http-equiv="refresh"|_0x[0-9a-f]{4}/i.test(String(body ?? ''));

/** Raw text fetch with retries. Challenge pages fall back to the user's Chrome unless JOB_NO_BROWSER_FALLBACK=1. */
export async function fetchText(url, { headers = {}, retries = 2, timeoutMs = 20000, accept = 'text/html,application/json;q=0.9,*/*;q=0.8' } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (res.status === 429 && !looksLikeChallenge(429, text)) throw new RateLimited(429, url, text.slice(0, 200));
      if (!res.ok) throw new HttpError(res.status, url, text.slice(0, 300));
      return text;
    } catch (e) {
      last = e;
      if (e instanceof HttpError && e.status === 404) throw e;
      if (e instanceof RateLimited) throw e;
      if (e instanceof HttpError && looksLikeChallenge(e.status, e.body)) break;
      if (i < retries) await sleep(1000 * (i + 1));
    }
  }
  if (last instanceof HttpError && looksLikeChallenge(last.status, last.body) && process.env.JOB_NO_BROWSER_FALLBACK !== '1') {
    if (!challengeWarned) { challengeWarned = true; console.error(`[http] ${new URL(url).host}: bot challenge for Node fetch, switching to your Chrome`); }
    const { fetchViaBrowser } = await import('./browser-fetch.mjs');
    return (await fetchViaBrowser(url, { referer: headers.Referer ?? headers.referer, timeoutMs, accept })).text;
  }
  throw last;
}
export async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, accept: 'application/json, text/plain, */*' });
  try { return JSON.parse(text); } catch { throw new HttpError(200, url, `non-JSON body: ${text.slice(0, 120)}`); }
}
