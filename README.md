# ai-job-studio

A job-search loop you run yourself: discover → score → tailor → prepare → apply → track → follow-up → outcome → retro.
AI only suggests. Submitting, legal, salary and visa answers are always yours.

Design: `research-design/job-search-ai-research/job-search-loop-design.zh-TW.md` (sibling repo). This repo is the implementation.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| P0 | Patchright + portable Chrome session broker | done in the research repo prototype |
| P1 | L3 data files, L5 state machine, S1 discover (Greenhouse + 104), S2 score mode | **this version** |
| P2 | S3 drafter / reviewer, PDF checks | next |
| P3+ | adapters `fill` / `wait_human`, LinkedIn, S6–S9, scheduling | later |

## Layout

```
config/      profile.yml portals.yml thresholds.yml blacklist.yml
cv.md        single source of truth for every claim in a tailored resume
adapters/    greenhouse.mjs 104.mjs  (search / detail / isLive; fill etc. in P3)
browser/     launch.mjs wait-human.mjs   (L1, Patchright + portable chrome.exe)
lib/         state.mjs pipeline.mjs dedup.mjs blacklist.mjs report.mjs scoring.mjs http.mjs browser-fetch.mjs
modes/       score.md   (run inside Claude Code / Codex)
scripts/     discover.mjs score-prep.mjs score-apply.mjs status.mjs daily.ps1
data/        pipeline.md tracker.md sessions.tsv scan-history.tsv status-log.tsv followups.md
reports/     one markdown file per job (frontmatter = machine fields)
profiles/    browser profiles, git-ignored
```

## Setup

```bash
npm install
# fill in config/profile.yml, config/portals.yml, cv.md
```

Portable Chrome is only needed when a site rejects Node's TLS fingerprint (104 does, via Cloudflare). Default path is
`C:\my\build\toolchain\GoogleChromePortable64-auto\App\Chrome-bin\chrome.exe`; override with `JOB_CHROME_EXE`.

## Daily loop (P1)

```bash
node scripts/discover.mjs            # S1: search portals → data/pipeline.md (dedup, blacklist). --recheck for liveness
node scripts/score-prep.mjs          # S2a: fetch full text → reports/NNN-*.md; deal-breaker hits scored 1 immediately
# S2b: in Claude Code, run modes/score.md (or: claude -p "$(cat modes/score.md)")
node scripts/score-apply.mjs         # S2c: validate scores, enforce thresholds, move rows to scored / skip
node scripts/status.mjs
```

`scripts/daily.ps1` chains all of the above for Task Scheduler (08:00 per the design). Pass `-NoLlm` to stop after prep.

## Data contracts

- `data/pipeline.md` row: `- [ ] url | company | title | source | found | state | score | report`. Checked box = terminal state.
- States: `discovered → scored → (skip | tailored) → prepared → filled → submitted → screening → interview → (offer | rejected | ghosted)`, plus `needs_human` from any pre-submit state. `lib/state.mjs` rejects anything else; `prepared → submitted` without a human does not exist.
- Every state change is appended to `data/status-log.tsv`; every scan to `data/scan-history.tsv`.
- Report frontmatter written by the scorer: `score`, `action`, `scores.{skills,seniority,location,compensation,red_flags}`, `deal_breaker`, `scored_by`, `scored_at`.

## Adapters

| Site | search | detail / liveness | Transport |
| --- | --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<board>/jobs` | `/jobs/<id>` (404 = closed) | plain fetch |
| 104 | `/jobs/search/api/jobs` | `/job/ajax/content/<id>` (`switch != on` = closed) | plain fetch; falls back to portable Chrome when Cloudflare challenges |

The 104 browser fallback (`lib/browser-fetch.mjs`) uses a dedicated, login-free profile `profiles/_api` and is headless by default
(`JOB_API_BROWSER_HEADLESS=0` for headed). Set `JOB_NO_BROWSER_FALLBACK=1` to disable it entirely.

## Tests

```bash
npm test
```

## Rules carried from the design

- No automatic submit, no CAPTCHA solving, no OTP reading. Anything that needs a person stops at `needs_human`.
- Session data (`profiles/`, `*.storageState.json`) never enters git.
- LLM output only lands in text files; pure scripts read those files and act.
