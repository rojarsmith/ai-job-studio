// Markdown → HTML → PDF via the user's own Chrome (Patchright, headless). No LaTeX, no extra binaries.
// Text-layer checks use pdftotext when available (poppler); page count falls back to parsing the PDF itself.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { marked } from 'marked';
import { ROOT } from './workspace.mjs';
import { P } from './paths.mjs';

export const REPO_TEMPLATES = path.join(ROOT, 'templates');

/** Workspace templates override repo defaults by file name. */
export function templatePath(name) {
  const ws = path.join(P.templates, name);
  if (fs.existsSync(ws)) return ws;
  const repo = path.join(REPO_TEMPLATES, name);
  if (fs.existsSync(repo)) return repo;
  throw new Error(`template not found: ${name} (looked in ${P.templates} and ${REPO_TEMPLATES})`);
}

export function renderHtml(markdown, { css = '', title = '', lang = 'en' } = {}) {
  const body = marked.parse(markdown, { gfm: true, breaks: false });
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Render one markdown file to PDF with Chrome. Returns output path. */
export async function markdownToPdf(mdFile, outFile, { cssName, page = {}, lang } = {}) {
  const md = fs.readFileSync(mdFile, 'utf8');
  const css = cssName ? fs.readFileSync(templatePath(cssName), 'utf8') : '';
  const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(mdFile, '.md')).trim();
  const html = renderHtml(md, { css, title, lang });
  const htmlFile = outFile.replace(/\.pdf$/i, '.html');
  fs.writeFileSync(htmlFile, html);
  const { chromium } = await import('patchright');
  const { resolveChrome } = await import('../browser/launch.mjs');
  const browser = await chromium.launch({ executablePath: resolveChrome(), headless: true });
  try {
    const pg = await browser.newPage();
    await pg.goto('file:///' + htmlFile.replace(/\\/g, '/'), { waitUntil: 'load' });
    await pg.emulateMedia({ media: 'print' });
    await pg.pdf({ path: outFile, format: page.format ?? 'A4', printBackground: true, preferCSSPageSize: true,
      margin: page.margin ?? { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' } });
  } finally { await browser.close(); }
  return outFile;
}

export function hasPdftotext() {
  const r = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' });
  return !r.error;
}
/** Text layer in reading order; '' when pdftotext is missing. Pages are separated by \f. */
export function pdfText(file) {
  if (!hasPdftotext()) return null;
  return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}
export function pageCount(file, text = undefined) {
  if (typeof text === 'string') return text.split('\f').filter((p, i, a) => i < a.length - 1 || p.trim()).length;
  const buf = fs.readFileSync(file, 'latin1');
  const m = buf.match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/);
  if (m) return Number(m[1]);
  return (buf.match(/\/Type\s*\/Page\b/g) ?? []).length;
}

/**
 * Checks from design S3: page limits, contact info extractable from the text layer, reading order
 * (name before the first section heading), and non-empty text layer. Returns { ok, problems, notes, pages }.
 */
export function checkPdf(file, { maxPages, contact = {}, kind = 'cv' } = {}) {
  const problems = [], notes = [];
  if (!fs.existsSync(file)) return { ok: false, problems: [`missing ${file}`], notes, pages: 0 };
  const text = pdfText(file);
  const pages = pageCount(file, text ?? undefined);
  if (maxPages && pages > maxPages) problems.push(`${kind}: ${pages} pages, limit ${maxPages}`);
  if (text === null) { notes.push('pdftotext not found: skipped text-layer checks (install poppler to enable)'); return { ok: problems.length === 0, problems, notes, pages }; }
  const flat = text.replace(/\s+/g, ' ');
  if (flat.trim().length < 200) problems.push(`${kind}: text layer nearly empty (${flat.trim().length} chars); ATS cannot read it`);
  const norm = (s) => String(s ?? '').replace(/[\s\-()]/g, '').toLowerCase();
  const flatNorm = norm(flat);
  for (const [k, v] of Object.entries(contact)) {
    if (!v) continue;
    if (!flatNorm.includes(norm(v))) problems.push(`${kind}: contact ${k} "${v}" not found in text layer`);
  }
  if (kind === 'cv' && contact.name) {
    const first = text.split('\f')[0];
    const nameAt = first.indexOf(contact.name);
    const headingAt = first.search(/\n\s*(experience|skills|education|summary|工作經歷|技能|學歷|摘要)\b/i);
    if (nameAt < 0) problems.push('cv: name not on page 1');
    else if (headingAt >= 0 && headingAt < nameAt) problems.push('cv: a section heading precedes the name; reading order is wrong');
  }
  notes.push(`${kind}: ${pages} page(s), ${flat.trim().length} chars of text`);
  return { ok: problems.length === 0, problems, notes, pages };
}
