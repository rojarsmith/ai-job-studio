import * as greenhouse from './greenhouse.mjs';
import * as ashby from './ashby.mjs';
import * as s104 from './104.mjs';
import * as linkedin from './linkedin.mjs';
import * as tsmc from './tsmc.mjs';
import * as yourator from './yourator.mjs';
import * as cake from './cake.mjs';

export const ADAPTERS = Object.freeze({ greenhouse, ashby, '104': s104, linkedin, tsmc, yourator, cake });
export function adapterFor(source) {
  const a = ADAPTERS[source];
  if (!a) throw new Error(`no adapter for source "${source}"`);
  return a;
}
export function adapterForUrl(url) {
  const u = String(url);
  if (/greenhouse\.io/.test(u) || /gh_jid=/.test(u)) return greenhouse;
  if (/ashbyhq\.com/.test(u)) return ashby;
  if (/104\.com\.tw/.test(u)) return s104;
  if (/linkedin\.com/.test(u)) return linkedin;
  if (/careers\.tsmc\.com/.test(u)) return tsmc;
  if (/yourator\.co/.test(u)) return yourator;
  if (/cake\.me/.test(u)) return cake;
  return null;
}
