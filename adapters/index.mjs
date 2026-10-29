import * as greenhouse from './greenhouse.mjs';
import * as s104 from './104.mjs';
import * as linkedin from './linkedin.mjs';

export const ADAPTERS = Object.freeze({ greenhouse, '104': s104, linkedin });
export function adapterFor(source) {
  const a = ADAPTERS[source];
  if (!a) throw new Error(`no adapter for source "${source}"`);
  return a;
}
export function adapterForUrl(url) {
  const u = String(url);
  if (/greenhouse\.io/.test(u) || /gh_jid=/.test(u)) return greenhouse;
  if (/104\.com\.tw/.test(u)) return s104;
  if (/linkedin\.com/.test(u)) return linkedin;
  return null;
}
