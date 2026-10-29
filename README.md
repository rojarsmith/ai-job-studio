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
| P4 | LinkedIn adapter, daily caps, lock detection | |
| P5 | S6 track, S7 follow-up, S8 outcome, S9 retro, scheduling | |

## Quick start

```bash
git clone https://github.com/rojarsmith/ai-job-studio && cd ai-job-studio
npm install
node scripts/workspace.mjs init          # creates ./workspace (git-ignored) from examples/
# edit workspace/config/profile.yml, workspace/config/portals.yml, workspace/cv.md
node scripts/workspace.mjs check         # layout + "will this leak into git" check
```

Daily loop:

```bash
node scripts/discover.mjs        # S1  search portals → workspace/data/pipeline.md (dedup, blacklist). --recheck for liveness
node scripts/score-prep.mjs      # S2a fetch full text → workspace/reports/NNN-*.md; deal-breaker hits scored 1 without an LLM
#                                  S2b in Claude Code: run modes/score.md (see "Running a mode" below)
node scripts/score-apply.mjs     # S2c validate scores, enforce thresholds, move rows to scored / skip
node scripts/status.mjs
```

Tailoring (S3), per application:

```bash
node scripts/tailor-prep.mjs       # S3a  applications/NNN/ with answers.md skeleton for every scored apply/maybe row
#                                    S3b  in Claude Code: run modes/tailor.md → cv.md, cover.md, review.md (drafter, then a fresh reviewer)
node scripts/build-pdf.mjs NNN     # S3c  Chrome → cv.pdf, cover.pdf; gate: ≤2 / ≤1 pages, contact info in text layer, name first
node scripts/tailor-apply.mjs NNN  # S3d  shows reviewer summary + checks; you read, then approve with --ok → state tailored
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
node scripts/apply.mjs 008 --dry-run    # S5  open the form, scan it, write applications/008/filled.json; nothing typed
node scripts/apply.mjs 008              # S5  fill text / select / upload; checkbox, radio and knock-out questions are listed for you;
                                        #     then it waits: you review, answer those, press submit in the window, type "submitted"
```

What `apply` never does: click a submit button, tick a checkbox or radio, answer salary / visa / legal / demographic questions, solve a CAPTCHA.
Gates before the browser opens: row state, per-site and total daily caps (`thresholds.daily_max`), same company + title already applied through another channel.

PDF rendering uses your Chrome (see `browser.yml`), so there is no LaTeX or pandoc to install. Text-layer checks need `pdftotext` from poppler; without it only page counts are checked and the gate says so.

## Credentials and login

Nothing in this repo stores a password. When a site is logged out, `prepare`/`apply` try the credential providers configured in `workspace/config/browser.yml` (off by default per site), type the login at human speed, and hand over to you the moment a 2FA, CAPTCHA, Passkey or "unusual activity" page appears. Providers:

| Provider | Where | Format |
| --- | --- | --- |
| `dir` | `<workspace>/secrets/<site>.txt` (or any folder via `credentials.dir.path`) | free text: `email: …` / `password: …` lines; Chinese labels ok; URLs and notes ignored |
| `file` | `<workspace>/config/credentials.yml` | `"104": { username, password, totp_secret }` |
| `env` | `JOB_CRED_104_USER`, `JOB_CRED_104_PASS`, `JOB_CRED_104_TOTP` | |

Any value may be `cmd:<command>` (read from your password manager CLI) or `dpapi:<blob>` (Windows DPAPI, current user; create with `node -e "import('./lib/credentials.mjs').then(m=>console.log(m.dpapiEncrypt('secret')))"`). TOTP codes are generated locally when a `totp_secret` is present; SMS / email OTP, Passkeys and CAPTCHAs are always yours.

Account locks: an "unusual activity" page marks the site locked in `data/sessions.tsv`; every script refuses that site for 24 hours.

## Workspace

Everything private is one directory with a fixed layout (see [examples/workspace/README.md](examples/workspace/README.md)). The code finds it in this order:

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

`node scripts/workspace.mjs check` fails if the workspace sits inside this repo without being ignored, or is a git repo without a `.gitignore`.

Settings that are machine-specific (Chrome binary, CDP port) live in `workspace/config/browser.yml`, not in code.

## Layout

```
adapters/     greenhouse.mjs 104.mjs      L2: search / detail / isLive now; fill / login_state / submit_gate in P3
browser/      launch.mjs session.mjs wait-human.mjs   L1: Patchright + real Chrome, per-site profile or CDP attach, ensureLoggedIn, wait_human
lib/          state pipeline dedup blacklist report scoring tailor pdf http browser-fetch workspace profile credentials sessions answers knockout form tracker login
modes/        score.md tailor.md          L4: prompts run inside Claude Code / Codex
scripts/      workspace discover score-prep score-apply tailor-prep build-pdf tailor-apply prepare apply status daily.ps1
templates/    resume.css cover.css        default stylesheets; <workspace>/templates/ overrides by file name
examples/     workspace/                  templates copied by `workspace init`; the only config in this repo
test/         node --test
```

## Data contracts

- `data/pipeline.md` row: `- [ ] url | company | title | source | found | state | score | report`. Checked box = terminal state.
- States: `discovered → scored → (skip | tailored) → prepared → filled → submitted → screening → interview → (offer | rejected | ghosted)`, plus `needs_human` from any pre-submit state. `lib/state.mjs` rejects everything else; `prepared → submitted` without a human does not exist.
- Every state change appends to `data/status-log.tsv`, every scan to `data/scan-history.tsv`.
- Report frontmatter written by the scorer: `score`, `action`, `scores.{skills,seniority,location,compensation,red_flags}`, `deal_breaker`, `scored_by`, `scored_at`.
- `applications/NNN/` (NNN = report id): `brief.md`, `answers.md` (facts from profile; legal / salary / visa lines are `needs_confirmation` and never auto-filled), `cv.md`, `cover.md`, `review.md` (keyword → evidence → `supported | removed | gap`, ending in `verdict: pass|fail`), `cv.pdf`, `cover.pdf`.
- `tailor-apply --ok` refuses unless review verdict is pass, both PDFs pass the checks, and the row is in `scored`. The approval is written to the report's `## Materials`.

## Adapters

| Site | search | detail / liveness | Transport |
| --- | --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<board>/jobs` | `/jobs/<id>` (404 = closed) | plain fetch |
| 104 | `/jobs/search/api/jobs` | `/job/ajax/content/<id>` (`switch != on` = closed) | plain fetch; falls back to your Chrome when Cloudflare challenges Node's TLS |

Login-state detection, login-form selectors and apply URLs per site are adapter defaults that `<workspace>/config/sites.yml` can override without code changes. The 104 login and apply selectors are **unverified** against the live site; run `prepare.mjs 104 --check` and `apply.mjs NNN --dry-run` first and adjust `sites.yml` if the scan finds nothing.

The Chrome fallback (`lib/browser-fetch.mjs`) uses a dedicated login-free profile `profiles/_api`. Headless by default; set `api_fetch_headless: false` in `browser.yml` if a site keeps challenging. `JOB_NO_BROWSER_FALLBACK=1` disables it.

## Tests

```bash
npm test
```

## License

MIT
