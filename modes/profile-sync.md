# Mode: profile-sync

Bring a person's profile on a job site (their own account, already logged in by them in the attached Chrome) in line with the
latest `source/cv*.md`. You drive the browser through `node scripts/tab-run.mjs`; you never log in, never submit an application,
never solve a CAPTCHA or 2FA (stop and tell the person).

Workspace: `node scripts/workspace.mjs path`. Tabs: `node scripts/tabs.mjs`.

## Before touching the site

1. Read `docs/sites/<site>.md`. Use its recipes and respect its limits and dead ends. If the site has no note yet, create one from the template in `docs/sites/README.md` as you learn it.
2. Read `source/cv.md` (and `cv.<lang>.md` for Chinese pages), `source/profile.yml`, `source/redact.yml`.
3. Redact first: apply `source/redact.yml` (`lib/redact.mjs`) to every text you will type, and drop anything it forbids. Files you upload come from `node scripts/resume-pdf.mjs`, which already applies it.
4. Decide, per field, one of: overwrite from the resume, leave alone, ask. Leave alone anything the person set deliberately and the resume does not contain (expected salary, job-search status, location preferences, privacy toggles). Never invent a value; if the form wants something the resume and `original/` do not have, list it.

## While editing

- One section at a time; read that section's text, not the whole page. Screenshots only when text cannot explain it.
- Respect length limits: when text does not fit, keep the facts that matter most for the target roles (see `profile.yml` `target_titles`), drop the rest, and report what was dropped.
- Save, reload, read back, compare. A silent failure (limit exceeded, validation) looks like success until you reload.
- Files: delete old versions only when the person asked for replacement; sites differ in how (see the note). Keep total size under the site's limit.

## After

1. Write what you learned into `docs/sites/<site>.md` in the same change: new selectors that worked, limits, quirks, and every dead end. Replace outdated lines instead of adding contradictions. No personal data.
2. Final message: what was changed, what was left alone and why, what was dropped for length, and **what the site wants that the workspace does not have**: list the documents or facts the person should add to `original/` (for example transcripts, certificates, language scores, a patent certificate), one line each, and which site field it fills. `original/` is read-only for you; do not create files there.
