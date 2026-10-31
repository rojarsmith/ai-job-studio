# ai-job-studio

A job-search loop you run on your own machine: **discover → score → tailor → prepare → apply → track → follow-up → outcome → retro**.
AI drafts and scores. You decide and you press submit. Nothing private ever lives in this repo.

Built from the research and design in [research-design/job-search-ai-research](https://github.com/rojarsmith/research-design) (Traditional Chinese), which compared career-ops, ai-job-search and get_jobs and specified a human-in-the-loop browser layer on Patchright.

## Principles

- **Code and private data are separate.** This repo is public code. Your resume, targets, job reports, applications and browser sessions live in a *workspace* directory that you control. See [Workspace](#workspace).
- **AI only writes text files.** Scoring and tailoring happen in Claude Code / Codex via `modes/*.md`; pure scripts read those files and act. An LLM hallucination can never become a browser action.
- **No automatic submit, no CAPTCHA solving, no OTP reading.** Anything that needs a person stops at `needs_human`, brings the window to front, and waits for you.
- **Login once, reuse.** Browser profiles persist per site; 2FA is done by hand once.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| P1 | workspace, data files, state machine, S1 discover (Greenhouse, 104), S2 score mode | done |
| P2 | S3 drafter / reviewer mode, PDF build with Chrome, page / text-layer / contact checks, human gate | **done** |
| P3 | credentials providers, S4 prepare (login state, auto login, `wait_human`), S5 apply (generic form filler, knock-outs, human submit, tracker, daily caps) | **done, needs live verification on 104** |
| P4 | LinkedIn adapter (guest search / detail, login state, Easy Apply multi-step fill), lock detection, daily caps | **done, needs live verification** |
| P5 | S6 track, S7 follow-up drafts, S8 interview prep / debrief / outcome, S9 weekly retro with suggestions, daily + weekly scheduling | **done** |

## Quick start

```bash
git clone https://github.com/rojarsmith/ai-job-studio && cd ai-job-studio
npm install
node scripts/workspace.mjs init --workspace D:/private/job-workspace   # any folder outside the repo; omit the flag for ./workspace (git-ignored)
echo D:/private/job-workspace > .workspace                             # pointer file (git-ignored) so every script finds it
# edit source/profile.yml, source/portals.yml, source/cv.md in that folder
node scripts/workspace.mjs check         # layout + "will this leak into git" check
```

Daily loop:

```bash
node scripts/discover.mjs        # S1  search portals → generated/data/pipeline.md (dedup, blacklist). --recheck for liveness
node scripts/score-prep.mjs      # S2a fetch full text → generated/reports/NNN-*.md; deal-breaker hits scored 1 without an LLM
#                                  S2b in Claude Code: run modes/score.md (see "Running a mode" below)
node scripts/score-apply.mjs     # S2c validate scores, enforce thresholds, move rows to scored / skip
node scripts/status.mjs
```

Tailoring (S3), per application:

```bash
node scripts/tailor-prep.mjs       # S3a  generated/applications/NNN/ (brief + per-job answers override) for every scored apply/maybe row; creates source/answers.md once
#                                    S3b  in Claude Code: run modes/tailor.md → cv.md, cover.md, review.md (drafter, then a fresh reviewer)
node scripts/ats-check.mjs NNN     # S3c  no Chrome (--file <md> checks any file, e.g. source/cv.md): standard sections, one date format newest-first, no tables/images, keyword coverage vs review.md
node scripts/build-pdf.mjs NNN     # S3d  ats-check, then Chrome → cv.pdf/cover.pdf + cv.docx/cover.docx; gate: ≤2 / ≤1 pages, contact in text layer, name first;
#                                          writes ATS-named copies <Name>-<Title>-CV.pdf (files.json)
node scripts/tailor-apply.mjs NNN  # S3e  shows reviewer summary + all checks; you read, then approve with --ok → state tailored
```

`scripts/daily.ps1 -Workspace <dir>` chains everything up to the human gates for Windows Task Scheduler.

### Running a mode

Modes are plain prompts. Interactively, open Claude Code in the repo and say "follow modes/score.md". Non-interactively:

```powershell
# PowerShell
claude -p (Get-Content modes/score.md -Raw) --add-dir workspace --permission-mode acceptEdits
```
```bash
# bash
claude -p "$(cat modes/score.md)" --add-dir workspace --permission-mode acceptEdits
```
```
:: cmd.exe (no command substitution; let the agent read the file)
claude -p "Read modes/score.md and follow it exactly." --add-dir workspace --permission-mode acceptEdits
```

`--add-dir` must point at the workspace, otherwise the agent cannot write reports. Replace `score.md` with `tailor.md` for S3.

Preparing and applying (S4, S5), with you next to the window:

```bash
node scripts/prepare.mjs 104            # S4  open 104 in your Chrome; auto-login from credentials if enabled, else wait for you; tailored → prepared
node scripts/prepare.mjs 104 --check    #     just report the login state
node scripts/apply.mjs 008 --dry-run    # S5  open the form, scan it, write generated/applications/008/filled.json; nothing typed
node scripts/apply.mjs 008              # S5  fill text / select / upload; checkbox, radio and knock-out questions are listed for you;
                                        #     then it waits: you review, answer those, press submit in the window, type "submitted"
```

Multi-step forms (LinkedIn Easy Apply, Workday): after you click Next in the window, type `next` and the newly visible step is scanned and filled the same way; `submitted` / `abort` end the loop. LinkedIn postings with an external Apply button are reported and left to you.

After submission (S6 to S9):

```bash
node scripts/track.mjs                                  # S6  counts by status, open applications
node scripts/track.mjs --set 008 screening "recruiter call"
node scripts/track.mjs --mark-ghosted                   #     submitted/screening untouched for thresholds.ghost_days → ghosted
node scripts/followup.mjs                               # S7  draft stubs at followup_days; modes/followup.md writes the text; you send
node scripts/followup.mjs --sent 008 7
node scripts/outcome.mjs 008 interview "on-site 11/12"  # S8  creates applications/008/interview.md for modes/interview.md
node scripts/outcome.mjs 008 debrief                    #     after the interview; modes/debrief.md expands your notes
node scripts/outcome.mjs 008 rejected "needs US work authorization"
node scripts/retro.mjs                                  # S9  retro/YYYY-WW.md: funnel per source, response by score, rejection buckets, suggestions
```

`modes/retro.md` reads that file and proposes threshold / keyword / blacklist changes under `## Decisions`; you apply what you accept. `scripts/weekly.ps1` runs the ghosting sweep, follow-up stubs, retro and both modes on Mondays.

What `apply` never does: click a submit button, tick a checkbox or radio, answer salary / visa / legal / demographic questions, solve a CAPTCHA.
Gates before the browser opens: row state, per-site and total daily caps (`thresholds.daily_max`), same company + title already applied through another channel.

PDF rendering uses your Chrome (see `browser.yml`), so there is no LaTeX or pandoc to install. Text-layer checks need `pdftotext` from poppler; without it only page counts are checked and the gate says so.

## Schedule

| When | What | Human needed |
| --- | --- | --- |
| daily 08:00 | `daily.ps1`: discover → score-prep → score mode → score-apply → tailor-prep → tailor mode → PDFs | no |
| daily, your working hours | review `tailor-apply NNN`, approve with `--ok`; `prepare <site>`; `apply NNN` and press submit | yes |
| daily 18:00 (optional) | `track.mjs` | no |
| Monday | `weekly.ps1`: ghosting sweep, follow-up drafts, retro, followup + retro modes | review decisions |
| weekly | `prepare <site> --check` for sites the retro flags as stale or locked | yes |

Never schedule `prepare` or `apply` unattended: they open logged-in sessions and stop at `wait_human`.

## Credentials and login

Nothing in this repo stores a password. When a site is logged out, `prepare`/`apply` try the credential providers configured in `source/browser.yml` (off by default per site), type the login at human speed, and hand over to you the moment a 2FA, CAPTCHA, Passkey or "unusual activity" page appears. Providers:

| Provider | Where | Format |
| --- | --- | --- |
| `dir` | `<workspace>/runtime/secrets/<site>.txt` (or any folder via `credentials.dir.path`) | free text: `email: …` / `password: …` lines; Chinese labels ok; URLs and notes ignored |
| `file` | `<workspace>/runtime/secrets/credentials.yml` | `"104": { username, password, totp_secret }` |
| `env` | `JOB_CRED_104_USER`, `JOB_CRED_104_PASS`, `JOB_CRED_104_TOTP` | |

Any value may be `cmd:<command>` (read from your password manager CLI) or `dpapi:<blob>` (Windows DPAPI, current user; create with `node -e "import('./lib/credentials.mjs').then(m=>console.log(m.dpapiEncrypt('secret')))"`). TOTP codes are generated locally when a `totp_secret` is present; SMS / email OTP, Passkeys and CAPTCHAs are always yours.

Account locks: an "unusual activity" page marks the site locked in `data/sessions.tsv`; every script refuses that site for 24 hours.

## Workspace

This repo is the read-only program; everything that is yours lives in one workspace directory, ideally outside the repo (a folder inside the repo is git-ignored but `git clean -x` deletes it). The code finds it in this order:

| Order | Source | Use case |
| --- | --- | --- |
| 1 | `--workspace <dir>` flag | one-off runs, multiple workspaces |
| 2 | `JOB_WORKSPACE` env var | scheduler, encrypted or synced drive |
| 3 | `<repo>/.workspace` pointer file (git-ignored) | permanent link to an external folder |
| 4 | `<repo>/workspace/` (git-ignored) | default |

Ways to keep it private, all equivalent to the code:

- **Local git-ignored folder** — the default.
- **Private git repo** — `node scripts/workspace.mjs init --from-git git@github.com:you/job-workspace.git`. The workspace gets its own `.gitignore` so browser sessions stay out even there.
- **Encrypted or synced drive** — point `JOB_WORKSPACE` or `.workspace` at it.
- **Anything else** — mount, decrypt, or generate a directory with the layout; nothing in the code assumes where it came from.

Inside the workspace, four tiers with one rule each (details in [examples/workspace/README.md](examples/workspace/README.md)):

| Tier | Holds | Who writes | Back up / commit? |
| --- | --- | --- | --- |
| `original/` | hand-written raw material you never want rewritten (bullet-list CV, notes) | you | yes |
| `source/` | `cv.md` (+ `cv.<lang>.md` translations), `profile.yml`, `portals.yml`, `thresholds.yml`, `blacklist.yml`, `browser.yml`, `sites.yml`, `answers.md`, `templates/` | you | yes |
| `generated/` | `reports/`, `applications/NNN/`, `data/` (pipeline, tracker, logs), `retro/` | scripts and modes | optional; delete it to restart with your settings intact |
| `runtime/` | `secrets/`, `profiles/` (browser sessions), `*.log` | scripts | never; the workspace `.gitignore` excludes it |

Code and modes never write into `original/`; `workspace.mjs lock` records a SHA-256 per file, makes them read-only, and `check` fails if one changes. Derive `source/cv.md` from it once with AI, then edit `source/` freely. Code and modes treat `source/` as read-only. The one exception is `tailor-prep`, which creates `source/answers.md` from `profile.yml` if it is missing and never touches it again.

`node scripts/workspace.mjs check` fails if the workspace sits inside this repo without being ignored, is a git repo without ignoring `runtime/`, or still uses the pre-tier flat layout (`node scripts/workspace.mjs migrate` moves it; `--dry-run` shows the plan). `workspace.mjs path generated` prints a tier path for scripts and modes.

Settings that are machine-specific (Chrome binary, CDP port) live in `source/browser.yml`, not in code.

### Attach mode

By default every site gets its own persistent Chrome profile under `runtime/profiles/<site>` (mode A). If you would rather keep using a Chrome you opened yourself, with your own tabs and logins (mode B), start that Chrome with a debugging port and set `attach: cdp` in `source/browser.yml`:

```powershell
# Chrome must not already be running from this user-data-dir; close it first (tabs come back via --restore-last-session).
& "C:\path\to\chrome.exe" --user-data-dir="C:\path\to\profile" --remote-debugging-port=9222 --restore-last-session
```

Patchright then attaches over CDP; nothing about the browser's fingerprint changes because it is literally your Chrome. `node scripts/tabs.mjs` lists the open tabs; `--scroll` reads each one with uneven mouse-wheel steps and pauses and reports headings, text size and whether the page looks like a job list. It never clicks, types or writes. A Chrome started without the port cannot be attached to afterwards; the scripts fail with a clear message instead of restarting it.

## Layout

```
adapters/     greenhouse.mjs 104.mjs      L2: search / detail / isLive now; fill / login_state / submit_gate in P3
browser/      launch.mjs session.mjs wait-human.mjs   L1: Patchright + real Chrome, per-site profile or CDP attach, ensureLoggedIn, wait_human
lib/          state pipeline dedup blacklist report scoring tailor pdf http browser-fetch workspace profile credentials sessions answers knockout form tracker login followups retro
modes/        score tailor followup interview debrief retro    L4: prompts run inside Claude Code / Codex
scripts/      workspace discover score-prep score-apply tailor-prep ats-check build-pdf tailor-apply tabs prepare apply track followup outcome retro status daily.ps1 weekly.ps1
templates/    resume.css cover.css        default stylesheets; <workspace>/source/templates/ overrides by file name
examples/     workspace/                  templates copied by `workspace init`; the only config in this repo
test/         node --test
```

## Data contracts

- `data/pipeline.md` row: `- [ ] url | company | title | source | found | state | score | report`. Checked box = terminal state.
- States: `discovered → scored → (skip | tailored) → prepared → filled → submitted → screening → interview → (offer | rejected | ghosted)`, plus `needs_human` from any pre-submit state. `lib/state.mjs` rejects everything else; `prepared → submitted` without a human does not exist.
- Every state change appends to `data/status-log.tsv`, every scan to `data/scan-history.tsv`.
- Report frontmatter written by the scorer: `score`, `action`, `scores.{skills,seniority,location,compensation,red_flags}`, `deal_breaker`, `scored_by`, `scored_at`.
- `source/answers.md`: facts shared by every form (from profile; legal / salary / visa lines are `needs_confirmation` and never auto-filled). `generated/applications/NNN/` (NNN = report id): `brief.md`, `answers.md` (per-job overrides and free text; wins key by key), `cv.md`, `cover.md`, `review.md` (keyword → evidence → `supported | removed | gap`, ending in `verdict: pass|fail`), `cv.pdf`, `cover.pdf`, `cv.docx`, `cover.docx`, ATS-named copies listed in `files.json` (what `apply` uploads; `thresholds.tailor.upload: pdf|docx`).
- ATS checks (`lib/ats.mjs`, run by `ats-check`, `build-pdf`, `tailor-apply`): H2 headings from the standard set (Summary, Skills, Experience, Education, …; zh-TW equivalents accepted), Skills + Experience present, every role `### Company — Title` with a date range in one format, newest first; no tables, images, HTML, emoji or multi-column text; keyword coverage = review.md keywords the draft mentions, must reach `thresholds.tailor.keyword_coverage_min` (default 0.5), and every `supported` keyword must appear in the draft. Words the posting uses that neither the reviewer nor the draft has are listed as notes only.
- `tailor-apply --ok` refuses unless review verdict is pass, both PDFs and the ATS checks pass, build-pdf has written the named copies, and the row is in `scored`. The approval is written to the report's `## Materials`.

## Adapters

| Site | search | detail / liveness | Transport |
| --- | --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<board>/jobs` | `/jobs/<id>` (404 = closed) | plain fetch |
| 104 | `/jobs/search/api/jobs` | `/job/ajax/content/<id>` (`switch != on` = closed) | plain fetch; falls back to your Chrome when Cloudflare challenges Node's TLS |
| LinkedIn | guest `jobs-guest/jobs/api/seeMoreJobPostings/search` (HTML cards) | guest `jobs/api/jobPosting/<id>` (404 = closed) | plain fetch; HTTP 429 = rate-limited, source stops for the run; JS wall → your Chrome |

Login-state detection, login-form selectors and apply URLs per site are adapter defaults that `<workspace>/source/sites.yml` can override without code changes. The 104 login and apply selectors are **unverified** against the live site; run `prepare.mjs 104 --check` and `apply.mjs NNN --dry-run` first and adjust `sites.yml` if the scan finds nothing.

The Chrome fallback (`lib/browser-fetch.mjs`) uses a dedicated login-free profile `runtime/profiles/_api`. Headless by default; set `api_fetch_headless: false` in `browser.yml` if a site keeps challenging. `JOB_NO_BROWSER_FALLBACK=1` disables it.

## Tests

```bash
npm test
```

## License

MIT
