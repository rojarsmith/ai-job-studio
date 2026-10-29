// Pure S3 helpers: answers skeleton, review parsing, materials record.
import fs from 'node:fs';
import path from 'node:path';

/** Form answers skeleton. Facts come from profile.yml; anything legal / salary / visa is needs_confirmation. */
export function answersSkeleton(profile = {}, job = {}) {
  const wa = profile.work_authorization ?? {};
  return `# Answers — ${job.company ?? ''} — ${job.title ?? ''}

Values the S5 adapter may type into the form. Lines marked needs_confirmation are NEVER filled automatically;
you answer them in the browser. Keep facts identical to profile.yml.

## Identity
- full_name: ${profile.name ?? ''}
- email: ${profile.email ?? ''}
- phone: ${profile.phone ?? ''}
- location: ${profile.location ?? ''}
- linkedin: ${profile.linkedin ?? ''}
- website: ${profile.website ?? ''}

## Eligibility (needs_confirmation)
- work_authorization_taiwan: ${wa.taiwan ?? ''}   # needs_confirmation
- work_authorization_other: ${wa.other ?? ''}     # needs_confirmation
- requires_sponsorship: ${wa.other === 'needs_sponsorship' ? 'yes (outside Taiwan)' : ''}   # needs_confirmation
- willing_to_relocate:    # needs_confirmation
- remote_preference: ${profile.remote_preference ?? ''}

## Compensation (needs_confirmation)
- salary_expectation: ${profile.salary ? `${profile.salary.currency ?? ''} ${profile.salary.monthly_min ?? ''}/month minimum` : ''}   # needs_confirmation
- notice_period:    # needs_confirmation
- earliest_start:   # needs_confirmation

## Free-text (drafted by modes/tailor.md, you approve)
- why_this_company:
- why_this_role:
- biggest_achievement:

## Knock-outs seen in the posting
(copied from the report's "knock-outs" line; each one needs_confirmation)
`;
}

/** review.md contract: a table "| keyword | evidence | verdict |" where verdict is supported | gap | removed. */
export function parseReview(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.*?)\s*\|\s*(supported|gap|removed)\s*\|\s*$/i);
    if (m) rows.push({ keyword: m[1], evidence: m[2], verdict: m[3].toLowerCase() });
  }
  const verdict = text.match(/^\s*verdict:\s*(pass|fail)\b/im)?.[1]?.toLowerCase() ?? null;
  return { rows, verdict, gaps: rows.filter((r) => r.verdict === 'gap').map((r) => r.keyword), unsupported: rows.filter((r) => r.verdict === 'gap' && /\bin cv\b|kept/i.test(r.evidence)) };
}

/** Append / replace the "## Materials" section of a report body. */
export function setMaterials(body, record) {
  const section = `## Materials\n\n${record.trim()}\n`;
  const start = body.search(/^## Materials[ \t]*$/m);
  if (start < 0) return body.replace(/\s*$/, '') + `\n\n${section}`;
  const rest = body.slice(start + '## Materials'.length);
  const next = rest.search(/^## /m);
  const tail = next < 0 ? '' : rest.slice(next);
  return body.slice(0, start) + section + tail;
}

export function listApplications(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{3,}$/.test(f) && fs.statSync(path.join(dir, f)).isDirectory()).sort();
}
