// Login-free HTTP with Chrome-like headers, retry and polite jitter.
// No browser here; L1 (browser/) is only for login-required flows.
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
export async function fetchJson(url, { headers = {}, retries = 2, timeoutMs = 20000 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, url, text.slice(0, 300));
      try { return JSON.parse(text); } catch { throw new HttpError(res.status, url, `non-JSON body: ${text.slice(0, 120)}`); }
    } catch (e) {
      last = e;
      if (e instanceof HttpError && e.status === 404) throw e;   // not retryable, and meaningful for liveness
      if (e instanceof HttpError && looksLikeChallenge(e.status, e.body)) break;  // Cloudflare: Node TLS rejected, go via Chrome
      if (i < retries) await sleep(1000 * (i + 1));
    }
  }
  if (last instanceof HttpError && looksLikeChallenge(last.status, last.body) && process.env.JOB_NO_BROWSER_FALLBACK !== '1') {
    if (!challengeWarned) { challengeWarned = true; console.error(`[http] ${new URL(url).host}: Cloudflare challenge for Node fetch, switching to portable Chrome`); }
    const { fetchJsonViaBrowser } = await import('./browser-fetch.mjs');
    return fetchJsonViaBrowser(url, { referer: headers.Referer ?? headers.referer, timeoutMs });
  }
  throw last;
}
let challengeWarned = false;
const looksLikeChallenge = (status, body) =>
  (status === 403 || status === 503) && /just a moment|cf-chl|challenge-platform|cloudflare/i.test(String(body ?? ''));
