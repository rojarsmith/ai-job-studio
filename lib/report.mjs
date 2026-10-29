// reports/NNN-company-title.md : one file per job. YAML frontmatter is the machine-readable part.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { P } from './paths.mjs';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
export const slug = (s, max = 40) => String(s ?? '').normalize('NFKC')
  .replace(/[（(].*?[)）]/g, ' ').replace(/\*\*.*?\*\*/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '') || 'x';

export function listReports(dir = P.reports) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{3,}-.*\.md$/.test(f)).sort();
}
export function nextId(dir = P.reports) {
  const ids = listReports(dir).map((f) => parseInt(f, 10)).filter(Number.isFinite);
  return String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0');
}
export function parseReport(text) {
  const m = text.match(FM_RE);
  if (!m) return { front: {}, body: text };
  return { front: yaml.load(m[1]) ?? {}, body: m[2] };
}
export function readReport(file, dir = P.reports) {
  return parseReport(fs.readFileSync(path.join(dir, file), 'utf8'));
}
export function writeReport(file, { front, body }, dir = P.reports) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), `---\n${yaml.dump(front, { lineWidth: 120, noRefs: true })}---\n${body.replace(/^\n+/, '')}`);
}

export function buildReport(id, job, { found }) {
  const front = {
    id, url: job.url, company: job.company, title: job.title, source: job.source, found,
    location: job.location ?? '', salary: job.salary ?? '', posted: job.posted ?? '',
    score: null, action: null,
    scores: { skills: null, seniority: null, location: null, compensation: null, red_flags: null },
    deal_breaker: null, scored_at: null, scored_by: null,
  };
  const meta = job.meta && Object.keys(job.meta).length
    ? '\n## Meta\n\n' + Object.entries(job.meta).map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v.replace(/\n+/g, ' ') : JSON.stringify(v)}`).join('\n') + '\n'
    : '';
  const body = `# ${job.company} — ${job.title}

${job.url}

## Score

(filled by modes/score.md: one line per dimension with evidence, then overall and action)

## Gaps

(S3 reviewer writes keywords that cv.md cannot support)

## Job description

${job.description || '(empty)'}
${job.requirements ? `\n## Requirements\n\n${job.requirements}\n` : ''}${meta}
## Materials

(S3)
`;
  return { front, body };
}
