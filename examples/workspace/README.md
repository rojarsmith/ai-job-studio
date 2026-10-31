# Workspace layout

`node scripts/workspace.mjs init [--workspace <dir>]` copies this folder into your workspace, never overwriting what is there. The code repo is the program; the workspace is everything that is yours. Keep it outside the repo (`.workspace` pointer file or `JOB_WORKSPACE`) so `git clean` can never reach it.

```
<workspace>/
  .gitignore            written by init; ignores runtime/ and *.log
  source/               YOU write; code and modes only read
    cv.md               the only evidence source for your skills and history (English; template with rules in comments)
    cv.<lang>.md        optional translation with identical facts (cv.zh-TW.md); modes use it when the posting is in that language
    profile.yml         who you are, targets, salary, deal-breakers (career-ops layout accepted too)
    portals.yml         which sites, keywords, boards, areas to scan
    thresholds.yml      score cut-offs, daily caps, follow-up days (optional, defaults in examples/)
    blacklist.yml       companies and title patterns to skip (optional)
    browser.yml         Chrome binary, attach mode, auto-login flags, credential providers (optional)
    sites.yml           per-site selector overrides for login / apply pages (optional)
    answers.md          facts the form filler may type, shared by every application (created once by tailor-prep)
    templates/          resume.css / cover.css overrides by file name (optional)
  generated/            scripts and modes write; safe to delete to restart
    data/               pipeline.md, tracker.md, followups.md, *.tsv logs
    reports/            NNN-company-title.md scoring reports
    applications/NNN/   brief, per-job answers override, tailored cv/cover (.md, .pdf, .docx, <Name>-<Title>-CV.* copies + files.json), review, filled.json
    retro/              YYYY-WW.md weekly retros
  runtime/              never leaves this machine; never committed or synced
    secrets/            <site>.txt or credentials.yml for auto-login (optional)
    profiles/           persistent Chrome profiles per site, storage states
    *.log               daily / weekly scheduler logs
```

Rules the code enforces or assumes:

- `source/profile.yml`, `source/portals.yml`, `source/cv.md` are required; `workspace.mjs check` fails without them.
- Optional `source/*.yml` fall back to the copies in this folder, or to empty defaults when there is no copy (browser, sites).
- `generated/applications/NNN/answers.md` overrides `source/answers.md` key by key; empty values do not override.
- `runtime/` is ignored by the workspace `.gitignore`; `check` fails if a git-managed workspace stops ignoring it.
- A pre-tier workspace (config/, data/ at top level) is refused; `workspace.mjs migrate --dry-run` shows the moves, `migrate` does them.

Backing up: `source/` is the part you cannot regenerate. `generated/` can be rebuilt by re-running the loop. `runtime/` should never be backed up.
