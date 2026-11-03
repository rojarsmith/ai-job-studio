# Ashby job boards (jobs.ashbyhq.com)

Verified live 2026-11-02. Employers host their own board on Ashby; there is no candidate account to sync.

- **Auth**: none for search or reading. The application form is at `https://jobs.ashbyhq.com/<board>/<uuid>/application`; filling and sending stay with the person (`submit_gate` returns `needs_human`).
- **Public API, no login**: `https://api.ashbyhq.com/posting-api/job-board/<board>?includeCompensation=true` returns every posting with `title`, `location`, `secondaryLocations[].location`, `isRemote` / `workplaceType` (often `null`), `publishedAt`, `jobUrl`, `descriptionPlain`, `descriptionHtml`, `compensation`. A wrong board name returns 404. There is **no per-job endpoint**: `adapters/ashby.mjs` reads the board and picks the posting; a missing posting means closed.
- **Board names** are the path segment of `jobs.ashbyhq.com/<board>`; they are not always the company name. Test one with a single `curl` before adding it.
- **Location strings are free text**: "Remote, Global", "Remote (Canada)", "San Francisco" plus a `Remote` flag. `isRemote` is set on hybrid roles too, so it does not mean "work from anywhere". To find roles open to a Taiwan resident match on the words `taiwan`, `taipei`, `apac`, `asia`, `worldwide`, `global`, `anywhere` and do not use a bare "remote".
- **Pay**: `compensation.compensationTierSummary` is filled only when the employer chooses to show it (`shouldDisplayCompensationOnJobPostings`); many boards return `null`, so score unknown pay as 3.
- **"Remote" is narrow**: most boards mark roles as remote within one country (often US-only) or as a US city with a remote flag; only a few say "Remote, Global". Match explicit location words rather than a bare "remote".
- **Cost**: about one second per board, no extra detail calls.
