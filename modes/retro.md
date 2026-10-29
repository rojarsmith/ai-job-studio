# Mode: retro (S9)

Read the newest `<workspace>/retro/YYYY-WW.md` (written by `scripts/retro.mjs`), plus `config/thresholds.yml`, `config/portals.yml`, `config/blacklist.yml`, `data/scan-history.tsv`, `data/status-log.tsv` and the `## Score` sections of reports that were skipped or ghosted this week. Workspace path: `node scripts/workspace.mjs path`.

Fill the retro file's `## Decisions` section with:

1. **What the numbers say** — three to five sentences. Which source converts, which score band responds, where rows pile up (many `scored` never `tailored` means the human gate is the bottleneck, not the market).
2. **Proposed changes**, each as a diff-like line the human can apply:
   - `thresholds.yml`: apply_min / maybe_min / daily_max / followup_days
   - `portals.yml`: keywords to add or drop per source, locations, boards
   - `blacklist.yml`: companies or title patterns that produced only rejections, ghosting or deal-breakers
   - `modes/score.md`: a scoring rule that was systematically off (cite two reports)
3. **Sessions and challenges** — sites that needed re-login, lock pages, CAPTCHA frequency; whether to lower that site's share.
4. **One experiment for next week** — a single change with a measurable outcome.

Rules: propose, do not apply. Quote report ids as evidence. Keep the section under 40 lines.
