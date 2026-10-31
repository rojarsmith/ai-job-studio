// ATS readiness checks for S3 drafts. Pure text; no browser, no LLM.
// An ATS does not rank by looks. It parses the file, indexes keywords, and lets a recruiter filter.
// So the only things worth checking are: can it parse (sections, dates, layout), and does it find the posting's words.
import { slug } from './report.mjs';

// ---- keywords -------------------------------------------------------------------------------

// Generic hard-skill lexicon for deterministic extraction from a posting. Lower-case; aliases map to a canonical key.
// This is a safety net under the reviewer's keyword table, not a replacement for it.
const LEXICON = `
javascript typescript python java kotlin scala go golang rust c c++ c# .net dotnet php ruby swift objective-c dart elixir erlang haskell clojure perl r matlab
sql nosql postgresql postgres mysql mariadb sqlite oracle mssql "sql server" mongodb redis memcached cassandra dynamodb elasticsearch opensearch neo4j clickhouse bigquery snowflake redshift
react vue angular svelte next.js nuxt node.js express nestjs django flask fastapi spring "spring boot" rails laravel asp.net graphql grpc rest restful openapi swagger websocket
html css sass tailwind webpack vite jest cypress playwright selenium storybook
aws gcp "google cloud" azure "alibaba cloud" ec2 s3 lambda eks gke aks cloudfront route53 iam vpc cloudwatch
docker kubernetes k8s helm istio terraform ansible pulumi cloudformation packer vagrant nginx envoy "service mesh"
linux unix bash shell powershell windows macos android ios
ci/cd "continuous integration" "continuous delivery" jenkins "github actions" gitlab "gitlab ci" circleci argocd argo "argo cd" tekton spinnaker
git github bitbucket jira confluence
kafka rabbitmq pulsar sqs "pub/sub" nats mqtt
prometheus grafana datadog "new relic" sentry splunk elk kibana logstash opentelemetry jaeger "distributed tracing" observability sre "site reliability" "on-call" oncall
microservices "event-driven" "domain-driven" ddd tdd bdd agile scrum kanban safe okr "design patterns" "system design" "distributed systems" "high availability" scalability "load balancing" caching
"machine learning" ml "deep learning" nlp llm "large language model" rag "computer vision" pytorch tensorflow keras scikit-learn pandas numpy spark hadoop airflow dbt databricks "data pipeline" etl "feature store" mlops
security oauth oauth2 oidc saml jwt sso "zero trust" owasp "penetration testing" soc2 "soc 2" iso27001 gdpr pci hipaa encryption tls
embedded rtos freertos firmware fpga verilog vhdl arm risc-v "device driver" bluetooth ble zigbee can uart spi i2c
"product management" roadmap "stakeholder management" "cross-functional" "technical program" tpm "program management" pmp "project management" "release management" "vendor management"
"people management" mentoring hiring "performance review" "team lead" "engineering manager" "head of" director vp "vice president" cto budget "p&l" headcount "career development" "1:1s"
"unit testing" "integration testing" "test automation" qa "quality assurance" "code review" "pair programming" refactoring "technical debt" documentation
fintech payments banking "e-commerce" saas b2b b2c healthcare gaming adtech edtech iot blockchain web3 solidity
english mandarin chinese japanese korean german french spanish "native speaker" toeic ielts toefl
bachelor master phd "computer science" "electrical engineering" "information engineering"
`.replace(/\n/g, ' ').match(/"[^"]+"|\S+/g).map((t) => t.replace(/^"|"$/g, ''));

const ALIASES = {
  k8s: 'kubernetes', golang: 'go', nodejs: 'node.js', node: 'node.js', postgres: 'postgresql', dotnet: '.net', 'c sharp': 'c#',
  'argo cd': 'argocd', oncall: 'on-call', 'soc 2': 'soc2', 'ci cd': 'ci/cd', js: 'javascript', ts: 'typescript', 'gitlab ci': 'gitlab',
  'site reliability': 'sre', 'technical program': 'tpm', 'large language model': 'llm', 'continuous integration': 'ci/cd', 'continuous delivery': 'ci/cd',
};
const canon = (k) => { const s = String(k).trim().toLowerCase().replace(/\s+/g, ' '); return ALIASES[s] ?? s; };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Word-ish presence test tolerant of punctuation around tech names (C++, .NET, Node.js, CI/CD). */
export function mentions(text, keyword) {
  const t = String(text).toLowerCase();
  const forms = new Set([canon(keyword), String(keyword).toLowerCase()]);
  for (const [a, c] of Object.entries(ALIASES)) if (c === canon(keyword)) forms.add(a);
  for (const f of forms) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}+#.])${escapeRe(f)}(?=$|[^\\p{L}\\p{N}+#])`, 'iu');
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * Deterministic keyword extraction from a posting: lexicon hits, ALL-CAPS acronyms (2-6 letters), CamelCase and dotted
 * product names. Returns canonical lower-case keywords in order of first appearance.
 */
export function extractKeywords(text, { extra = [] } = {}) {
  const src = String(text ?? '');
  const found = new Map();  // canon -> first index
  const add = (k, i) => { const c = canon(k); if (c.length < 2) return; if (!found.has(c)) found.set(c, i); };
  for (const term of [...LEXICON, ...extra]) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}+#.])${escapeRe(term)}(?=$|[^\\p{L}\\p{N}+#])`, 'iu');
    const m = src.match(re);
    if (m) add(term, m.index);
  }
  for (const m of src.matchAll(/(?<![A-Za-z0-9/+#.-])([A-Z][A-Z0-9]{1,5})(?![A-Za-z0-9/+#-])/g)) {
    if (/^(AND|OR|THE|FOR|WITH|NOT|YOU|WE|OUR|ARE|ALL|ANY|CAN|EOE|USA|UK|EU|TW|PM|AM|ETC|LLC|INC|LTD|CO|US|IT|HR)$/.test(m[1])) continue;
    add(m[1], m.index);
  }
  for (const m of src.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|[A-Za-z]+\.(?:js|NET|io|py))\b/g)) add(m[1], m.index);
  const keys = [...found.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  // "github" adds nothing next to "github actions"; keep the longer phrase only
  return keys.filter((k) => !keys.some((o) => o !== k && o.length > k.length && mentions(o, k)));
}

/**
 * Keyword coverage of a draft. `keywords` may be strings or review rows { keyword, verdict }.
 * Returns hit / miss lists, the ratio, and `fixable`: keywords the reviewer marked supported that the draft does not mention.
 */
export function keywordCoverage(keywords, draft) {
  const rows = keywords.map((k) => (typeof k === 'string' ? { keyword: k, verdict: null } : k));
  const seen = new Set();
  const hit = [], miss = [], fixable = [];
  for (const r of rows) {
    const c = canon(r.keyword);
    if (seen.has(c)) continue; seen.add(c);
    if (mentions(draft, r.keyword)) hit.push(r.keyword);
    else { miss.push(r.keyword); if (r.verdict === 'supported') fixable.push(r.keyword); }
  }
  const total = hit.length + miss.length;
  return { hit, miss, fixable, total, ratio: total ? hit.length / total : 1 };
}

// ---- structure ------------------------------------------------------------------------------

// Headings an ATS parser recognises. Key = canonical section; values = accepted spellings (lower-case, en + zh).
export const SECTIONS = {
  summary: ['summary', 'professional summary', 'profile', 'about', 'objective', '摘要', '簡介', '個人簡介', '自我介紹'],
  skills: ['skills', 'technical skills', 'core skills', 'core competencies', 'technologies', '技能', '專業技能', '核心能力'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', '工作經歷', '經歷', '工作經驗'],
  education: ['education', '學歷', '教育背景'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses & certifications', '證照', '認證'],
  projects: ['projects', 'selected projects', 'open source', '專案', '專案經歷'],
  publications: ['publications', 'talks', 'publications & talks', 'patents', 'publications & patents', 'patents & publications', '著作', '發表', '專利', '著作與專利', '專利與著作'],
  languages: ['languages', '語言', '語言能力'],
  awards: ['awards', 'honors', 'honours', 'awards & honors', '獲獎', '榮譽'],
  volunteering: ['volunteering', 'volunteer experience', '志工'],
  interests: ['interests', '興趣'],
};
const REQUIRED_SECTIONS = ['skills', 'experience'];
export function sectionKey(heading) {
  const h = String(heading).trim().toLowerCase().replace(/[:：]\s*$/, '');
  for (const [k, names] of Object.entries(SECTIONS)) if (names.includes(h)) return k;
  return null;
}

/** Parse the markdown shape from templates/README.md into { name, contact, sections:[{heading,key,roles:[{title,meta,bullets}]}] }. */
export function parseCv(md) {
  const lines = String(md).replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').split('\n');   // comments guide humans and AI; never content
  const out = { name: null, contact: null, sections: [], tables: 0, images: 0, html: 0, emoji: 0, columns: 0 };
  let sec = null, role = null, afterH1 = false, afterH3 = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) out.tables++;
    if (/!\[[^\]]*\]\(/.test(line)) out.images++;
    if (/<(div|table|span|img|style|br|col|td|tr)\b/i.test(line)) out.html++;
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line)) out.emoji++;
    if (/\t{2,}|\s{6,}\S.*\s{6,}\S/.test(line) && !/^\s*[-*]/.test(line)) out.columns++;
    let m;
    if ((m = line.match(/^#\s+(.+)$/))) { out.name = m[1].trim(); afterH1 = true; continue; }
    if ((m = line.match(/^##\s+(.+)$/))) { sec = { heading: m[1].trim(), key: sectionKey(m[1]), roles: [], bullets: 0, text: '' }; out.sections.push(sec); role = null; afterH1 = false; continue; }
    if ((m = line.match(/^###\s+(.+)$/))) { role = { title: m[1].trim(), meta: null, bullets: 0 }; sec?.roles.push(role); afterH3 = true; afterH1 = false; continue; }
    if (!line.trim()) continue;
    if (afterH1 && !out.contact) { out.contact = line.trim(); afterH1 = false; continue; }
    if (afterH3 && role && !role.meta && !/^\s*[-*]\s/.test(line)) { role.meta = line.trim(); afterH3 = false; continue; }
    afterH3 = false;
    if (/^\s*[-*]\s/.test(line)) { if (role) role.bullets++; if (sec) sec.bullets++; }
    if (sec) sec.text += line + '\n';
  }
  return out;
}

// Date formats an ATS reliably reads. Each entry: name, regex for one date. Range = date (to|–|-|—) (date|present|now|current|至今|現在).
const DATE_FORMS = [
  { name: 'YYYY-MM', re: /\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/ },
  { name: 'YYYY/MM', re: /\b(19|20)\d{2}\/(0?[1-9]|1[0-2])\b/ },
  { name: 'YYYY.MM', re: /\b(19|20)\d{2}\.(0[1-9]|1[0-2])\b/ },
  { name: 'Mon YYYY', re: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? (19|20)\d{2}\b/ },
  { name: 'MM/YYYY', re: /\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b/ },
  { name: 'YYYY年MM月', re: /(19|20)\d{2}年\s?(0?[1-9]|1[0-2])月/ },
  { name: 'YYYY', re: /\b(19|20)\d{2}\b/ },
];
const PRESENT = /\b(present|now|current|today|ongoing)\b|至今|現在|迄今|仍在職|在職中/i;
// "to" / "-" need spaces around them so "2021-03" stays one token; "至" alone is a separator, "至今" is "present".
const RANGE_SEP = /\s+(?:to|-|–|—|~|〜)\s+|\s*(?:–|—|~|〜)\s*|\s*至(?!今)\s*/i;

export function dateFormOf(text) {
  for (const f of DATE_FORMS) if (f.re.test(text)) return f.name;
  return null;
}
function monthIndex(text, form) {
  const t = String(text);
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  let y, m = 6;
  let x;
  if ((x = t.match(/(19|20)\d{2}[-/.年]\s?(\d{1,2})/))) { y = Number(x[0].slice(0, 4)); m = Number(x[2]); }
  else if ((x = t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? ((19|20)\d{2})/i))) { y = Number(x[2]); m = MON[x[1].slice(0, 3).toLowerCase()]; }
  else if ((x = t.match(/\b(\d{1,2})\/((19|20)\d{2})/))) { y = Number(x[2]); m = Number(x[1]); }
  else if ((x = t.match(/\b((19|20)\d{2})\b/))) y = Number(x[1]);
  else if (PRESENT.test(t)) return 999999;
  else return null;
  void form;
  return y * 12 + m;
}

/** Roles under Experience: every H3 needs "Company — Title" and a meta line with one date range; all ranges in one format, newest first. */
export function checkRoles(cv) {
  const problems = [], notes = [];
  const exp = cv.sections.filter((s) => s.key === 'experience');
  const roles = exp.flatMap((s) => s.roles);
  if (exp.length && !roles.length) problems.push('experience section has no "### Company — Title" entries');
  const forms = new Map();
  let prevStart = null;
  for (const r of roles) {
    if (!/\s[—–-]\s|\s\|\s|\s@\s/.test(r.title) && !/[，,]/.test(r.title)) problems.push(`role "${r.title}": heading should be "Company — Title"`);
    if (!r.meta) { problems.push(`role "${r.title}": no date line under the heading`); continue; }
    const form = dateFormOf(r.meta);
    if (!form) { problems.push(`role "${r.title}": date line "${r.meta}" has no recognisable date`); continue; }
    if (form === 'YYYY') notes.push(`role "${r.title}": year-only dates; ATS tenure math prefers months (YYYY-MM)`);
    let parts = r.meta.split(RANGE_SEP).filter((p) => dateFormOf(p) || PRESENT.test(p));
    if (parts.length === 1 && PRESENT.test(r.meta)) parts = [parts[0], 'present'];   // "2017-01 至今" has no separator
    if (parts.length < 2) problems.push(`role "${r.title}": date line needs a range "start to end|present"`);
    forms.set(form, (forms.get(form) ?? 0) + 1);
    const start = monthIndex(parts[0] ?? r.meta, form), end = parts[1] ? monthIndex(parts[1], form) : null;
    if (start && end && end < start) problems.push(`role "${r.title}": end date before start date`);
    if (prevStart !== null && start && start > prevStart) problems.push(`role "${r.title}": not in reverse-chronological order`);
    if (start) prevStart = start;
    if (!r.bullets) notes.push(`role "${r.title}": no bullets`);
  }
  if (forms.size > 1) problems.push(`mixed date formats across roles: ${[...forms.keys()].join(', ')}; use one`);
  return { problems, notes, roles: roles.length };
}

export function checkSections(cv) {
  const problems = [], notes = [];
  const keys = cv.sections.map((s) => s.key);
  for (const s of cv.sections) if (!s.key) problems.push(`non-standard section heading "## ${s.heading}"; use one of: ${Object.keys(SECTIONS).join(', ')}`);
  for (const k of REQUIRED_SECTIONS) if (!keys.includes(k)) problems.push(`missing section "## ${k[0].toUpperCase() + k.slice(1)}"`);
  if (!keys.includes('education')) notes.push('no Education section');
  const dup = keys.filter((k, i) => k && keys.indexOf(k) !== i);
  if (dup.length) problems.push(`duplicate sections: ${[...new Set(dup)].join(', ')}`);
  if (!cv.name) problems.push('no "# Full Name" heading');
  if (!cv.contact) problems.push('no contact line under the name');
  else if (!/@/.test(cv.contact)) problems.push('contact line has no email');
  return { problems, notes };
}

export function checkLayout(cv) {
  const problems = [];
  if (cv.tables) problems.push(`${cv.tables} table line(s): ATS parsers scramble tables`);
  if (cv.images) problems.push(`${cv.images} image(s): ATS cannot read images`);
  if (cv.html) problems.push(`${cv.html} raw HTML line(s): keep markdown only`);
  if (cv.emoji) problems.push(`${cv.emoji} line(s) with emoji/icons`);
  if (cv.columns) problems.push(`${cv.columns} line(s) look like multi-column text`);
  return { problems };
}

/**
 * Full check of one cv.md. keywords: strings or review rows. Options: coverageMin (0..1), posting text for the lexicon pass.
 * Returns { ok, problems, notes, coverage, lexicon }.
 */
export function atsCheck(md, { keywords = [], posting = '', coverageMin = 0.5, kind = 'cv' } = {}) {
  const cv = parseCv(md);
  const problems = [], notes = [];
  if (kind === 'cv') {
    for (const r of [checkSections(cv), checkRoles(cv), checkLayout(cv)]) { problems.push(...r.problems); notes.push(...(r.notes ?? [])); }
  } else {
    problems.push(...checkLayout(cv).problems);
    if (!cv.name) problems.push('no "# Full Name" heading');
  }
  const coverage = keywordCoverage(keywords, md);
  if (keywords.length) {
    notes.push(`keyword coverage ${coverage.hit.length}/${coverage.total} (${Math.round(coverage.ratio * 100)}%)`);
    if (coverage.fixable.length) problems.push(`reviewer says supported but draft never mentions: ${coverage.fixable.join(', ')}`);
    if (coverage.ratio < coverageMin) problems.push(`keyword coverage ${Math.round(coverage.ratio * 100)}% below ${Math.round(coverageMin * 100)}%; missing: ${coverage.miss.join(', ')}`);
  }
  let lexicon = null;
  if (posting) {
    const extracted = extractKeywords(posting).filter((k) => !keywords.some((r) => canon(typeof r === 'string' ? r : r.keyword) === k));
    lexicon = keywordCoverage(extracted, md);
    if (lexicon.miss.length) notes.push(`posting also mentions (not in review table, not in draft): ${lexicon.miss.slice(0, 15).join(', ')}${lexicon.miss.length > 15 ? ', …' : ''}`);
  }
  return { ok: problems.length === 0, problems, notes, coverage, lexicon, cv };
}

// ---- file names -----------------------------------------------------------------------------

/** "<Name>-<Title>-CV.pdf": ATS indexes the file name too, and recruiters see it in the attachment list. */
export function atsFileName(name, title, kind = 'CV', ext = 'pdf') {
  const n = slug(name, 30).replace(/-+/g, '-'), t = slug(title, 40).replace(/-+/g, '-');
  return [n !== 'x' ? n : null, t !== 'x' ? t : null, kind].filter(Boolean).join('-') + '.' + ext;
}

// ---- per-application entry point used by ats-check, build-pdf, tailor-apply ------------------

/**
 * Run the checks for one applications/NNN folder. `reportBody` is the posting (report markdown body);
 * review.md rows supply the keywords; thresholds.tailor.keyword_coverage_min sets the gate.
 * Returns { cv: result|null, cover: result|null, problems, notes }.
 */
export function checkApplication(dir, { reportBody = '', thresholds = {}, fs: fsMod, path: pathMod, parseReview }) {
  const cvFile = pathMod.join(dir, 'cv.md'), coverFile = pathMod.join(dir, 'cover.md'), reviewFile = pathMod.join(dir, 'review.md');
  const rows = fsMod.existsSync(reviewFile) ? parseReview(fsMod.readFileSync(reviewFile, 'utf8')).rows : [];
  const posting = postingText(reportBody);
  const coverageMin = thresholds.keyword_coverage_min ?? 0.5;
  const out = { cv: null, cover: null, problems: [], notes: [] };
  if (fsMod.existsSync(cvFile)) {
    out.cv = atsCheck(fsMod.readFileSync(cvFile, 'utf8'), { keywords: rows, posting, coverageMin, kind: 'cv' });
    out.problems.push(...out.cv.problems.map((p) => `cv.md: ${p}`)); out.notes.push(...out.cv.notes.map((n) => `cv.md: ${n}`));
    if (!rows.length) out.notes.push('cv.md: no review.md keyword table; coverage not measured');
  } else out.problems.push('cv.md missing');
  if (fsMod.existsSync(coverFile)) {
    out.cover = atsCheck(fsMod.readFileSync(coverFile, 'utf8'), { kind: 'cover' });
    out.problems.push(...out.cover.problems.map((p) => `cover.md: ${p}`));
  }
  return out;
}
/** The posting part of a report body: "## Job description" and "## Requirements" sections only. */
export function postingText(body) {
  const want = new Set(['job description', 'requirements']);
  const out = [];
  let keep = false;
  for (const line of String(body).replace(/\r\n/g, '\n').split('\n')) {
    const h = line.match(/^## (.+?)\s*$/);
    if (h) { keep = want.has(h[1].toLowerCase()); continue; }
    if (keep) out.push(line);
  }
  return out.join('\n');
}
