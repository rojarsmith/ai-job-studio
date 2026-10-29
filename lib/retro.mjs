// Pure statistics for S9 retro. Inputs are plain arrays so this is testable without a workspace.
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const RESPONDED = new Set(['screening', 'interview', 'offer']);
const INTERVIEW = new Set(['interview', 'offer']);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');

/** Funnel per source from pipeline rows + tracker rows (joined on report id / channel). */
export function funnelBySource(pipelineRows, trackerRows) {
  const out = {};
  const bump = (src, k) => { out[src] ??= { discovered: 0, scored: 0, skipped: 0, tailored: 0, submitted: 0, responded: 0, interview: 0, offer: 0, rejected: 0, ghosted: 0 }; out[src][k]++; };
  for (const r of pipelineRows) {
    bump(r.source, 'discovered');
    if (r.score) bump(r.source, 'scored');
    if (r.state === 'skip') bump(r.source, 'skipped');
    if (['tailored', 'prepared', 'filled', 'submitted', 'screening', 'interview', 'offer', 'rejected', 'ghosted'].includes(r.state)) bump(r.source, 'tailored');
  }
  for (const t of trackerRows) {
    bump(t.channel, 'submitted');
    if (RESPONDED.has(t.status)) bump(t.channel, 'responded');
    if (INTERVIEW.has(t.status)) bump(t.channel, 'interview');
    if (t.status === 'offer') bump(t.channel, 'offer');
    if (t.status === 'rejected') bump(t.channel, 'rejected');
    if (t.status === 'ghosted') bump(t.channel, 'ghosted');
  }
  for (const v of Object.values(out)) { v.apply_rate = pct(v.submitted, v.discovered); v.response_rate = pct(v.responded, v.submitted); v.interview_rate = pct(v.interview, v.submitted); }
  return out;
}

/** Response rate per score band: scores from pipeline rows (by report id prefix) joined to tracker status. */
export function responseByScore(pipelineRows, trackerRows) {
  const score = new Map(pipelineRows.filter((r) => r.report).map((r) => [r.report.slice(0, 3), Number(r.score) || 0]));
  const bands = {};
  for (const t of trackerRows) {
    const s = score.get(t.id) ?? 0;
    const b = bands[s] ??= { submitted: 0, responded: 0, interview: 0 };
    b.submitted++;
    if (RESPONDED.has(t.status)) b.responded++;
    if (INTERVIEW.has(t.status)) b.interview++;
  }
  for (const b of Object.values(bands)) b.response_rate = pct(b.responded, b.submitted);
  return bands;
}

/** Rejection reasons from status-log reason column, bucketed by keyword. */
export function rejectionReasons(statusLogRows) {
  const buckets = { seniority: /senior|junior|level|overqualif|underqualif|experience/i, location: /location|relocat|remote|country|visa|sponsor|timezone|authori[sz]|eligib/i, salary: /salary|compensation|budget|pay/i, skills: /skill|stack|technical|language|tool/i, process: /test|assessment|leetcode|interview/i, no_reason: /^$|no reason|generic|template|auto/i };
  const out = { total: 0 };
  for (const r of statusLogRows) {
    if (r.to !== 'rejected') continue;
    out.total++;
    const k = Object.entries(buckets).find(([, re]) => re.test(r.reason ?? ''))?.[0] ?? 'other';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Deterministic hints a human can accept or ignore; the LLM retro mode adds judgement on top. */
export function suggestions({ funnel, bands, sessions, thresholds, staleDays = 14, now = Date.now() }) {
  const s = [];
  const b3 = bands[3], b4 = bands[4], b5 = bands[5];
  if (b3 && b3.submitted >= 5 && b3.responded === 0 && (b4?.responded || b5?.responded)) s.push(`score-3 applications: ${b3.submitted} sent, 0 responses while 4-5 got some → consider maybe_min: 4 (currently ${thresholds.maybe_min})`);
  for (const [src, f] of Object.entries(funnel)) {
    if (f.discovered >= 20 && f.submitted === 0) s.push(`${src}: ${f.discovered} discovered, 0 submitted → keywords or locations too broad, or the pipeline is stuck before S5`);
    if (f.submitted >= 5 && f.ghosted / f.submitted >= 0.6) s.push(`${src}: ${f.ghosted}/${f.submitted} ghosted → lower its share or raise apply_min for it`);
  }
  for (const se of sessions) {
    if (se.locked) s.push(`${se.site}: LOCKED since ${se.locked.slice(0, 10)} → check the account by hand before any automation`);
    else if (se.last_verified && now - Date.parse(se.last_verified) > staleDays * 86400000) s.push(`${se.site}: session last verified ${se.last_verified} → run prepare.mjs ${se.site} this week`);
  }
  return s;
}

export function renderRetro({ week, funnel, bands, reasons, scans, suggestions: sug, notes = [] }) {
  const srcRows = Object.entries(funnel).map(([k, v]) => `| ${k} | ${v.discovered} | ${v.scored} | ${v.skipped} | ${v.submitted} | ${v.responded} | ${v.interview} | ${v.offer} | ${v.rejected} | ${v.ghosted} | ${v.apply_rate} | ${v.response_rate} | ${v.interview_rate} |`).join('\n') || '| (none) | | | | | | | | | | | | |';
  const bandRows = Object.entries(bands).sort((a, b) => b[0] - a[0]).map(([k, v]) => `| ${k} | ${v.submitted} | ${v.responded} | ${v.interview} | ${v.response_rate} |`).join('\n') || '| (none) | | | | |';
  const reasonRows = Object.entries(reasons).filter(([k]) => k !== 'total').map(([k, v]) => `| ${k} | ${v} |`).join('\n') || '| (none) | |';
  return `# Retro ${week}

## Funnel by source

| source | discovered | scored | skipped | submitted | responded | interview | offer | rejected | ghosted | apply rate | response rate | interview rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${srcRows}

## Response by score

| score | submitted | responded | interview | response rate |
| --- | --- | --- | --- | --- |
${bandRows}

## Rejection reasons (${reasons.total})

| bucket | count |
| --- | --- |
${reasonRows}

## Scans this week

${scans.length ? scans.map((s) => `- ${s.date} ${s.source}: found ${s.found}, new ${s.new} (${s.duration_ms} ms)`).join('\n') : '- none'}

## Suggestions (deterministic)

${sug.length ? sug.map((x) => `- ${x}`).join('\n') : '- nothing stands out'}

## Notes

${notes.length ? notes.map((x) => `- ${x}`).join('\n') : '- (challenge pages met, sites blocked, parameters changed — fill in)'}

## Decisions

(modes/retro.md proposes changes to thresholds.yml, portals.yml keywords and blacklist.yml here; you apply the ones you accept)
`;
}
