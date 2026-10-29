// Dedup = normalized URL match, OR same company + near-identical title.
const DROP_PARAMS = /^(utm_|gh_src|ref|source|src|fbclid|gclid|jobsource|channel)/i;

export function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...url.searchParams.keys()]) if (DROP_PARAMS.test(k)) url.searchParams.delete(k);
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\?$/, '');
  } catch { return String(u).trim().toLowerCase(); }
}
export const normalizeText = (s) => String(s ?? '').toLowerCase()
  .replace(/[（(].*?[)）]/g, ' ')          // drop parenthesised salary / notes
  .replace(/\*\*.*?\*\*/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

const bigrams = (s) => {
  const t = s.replace(/\s/g, '');
  const b = new Map();
  for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); b.set(g, (b.get(g) ?? 0) + 1); }
  return b;
};
export function similarity(a, b) {
  const A = bigrams(normalizeText(a)), B = bigrams(normalizeText(b));
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0; for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return total === 0 ? 0 : (2 * inter) / total;
}
export function isDuplicate(cand, existing, { titleThreshold = 0.9 } = {}) {
  const cu = normalizeUrl(cand.url);
  const cc = normalizeText(cand.company);
  for (const e of existing) {
    if (normalizeUrl(e.url) === cu) return e;
    if (cc && normalizeText(e.company) === cc && similarity(cand.title, e.title) >= titleThreshold) return e;
  }
  return null;
}
