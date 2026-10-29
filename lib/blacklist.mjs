import { loadConfig } from './config.mjs';
import { normalizeText } from './dedup.mjs';
export function blacklistReason(job, bl = loadConfig('blacklist')) {
  const company = normalizeText(job.company);
  for (const c of bl.companies ?? []) if (company && company === normalizeText(c)) return `company:${c}`;
  for (const p of bl.title_patterns ?? []) if (new RegExp(p, 'i').test(job.title ?? '')) return `title:${p}`;
  for (const u of bl.url_contains ?? []) if (String(job.url ?? '').includes(u)) return `url:${u}`;
  return null;
}
