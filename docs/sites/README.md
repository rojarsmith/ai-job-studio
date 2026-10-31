# Site notes

What is known about each job site's profile and application pages, written down so nobody pays twice to rediscover it.
Selectors, field names, limits, quirks, working recipes and **dead ends**. Public and shared: nothing here identifies a person
(no names, ids, resume text, keywords tuned to one user; use `<placeholders>`).

| Site | Note |
| --- | --- |
| TSMC Careers (careers.tsmc.com) | [tsmc.md](tsmc.md) |
| 104 人力銀行 (104.com.tw) | [104.md](104.md) |
| Cake (cake.me) | [cake.md](cake.md) |
| LinkedIn | [linkedin.md](linkedin.md) |

## Rules for whoever touches a site (human or `modes/profile-sync.md`)

1. **Read the site's note first.** Use its recipes instead of exploring. Dumping a whole page into the context is the most expensive way to learn one field name.
2. **Look at one section at a time.** `p.evaluate` the specific container's `innerText`, not `document.body.innerText`; take a screenshot only when text does not explain it.
3. **Write back what you learned, in the same change that used it.** A new selector that worked, a limit that bit, a button that is named differently than it looks, and every dead end ("tried X, fails because Y"). Failed attempts are the most valuable lines: they are what stops the next run from repeating them.
4. **Fix stale entries.** If a recipe no longer works, replace it and note the date and what changed on the site. Do not stack contradictory advice.
5. **Keep it short and generic.** Prefer label text and ARIA names over generated ids; list ids only as "seen as", with how they are built.
6. **Never record or publish personal data.** Apply the workspace's `source/redact.yml` to anything typed into a public profile (`lib/redact.mjs`).
7. **Do not describe bot-challenge workarounds.** On CAPTCHA, 2FA or an "unusual activity" page the tools stop and hand the page to the person.

## Tools that make this cheap

- `node scripts/tabs.mjs` lists the tabs of the Chrome you attached; `node scripts/tab-run.mjs <url-substring> <script.js>` runs a short script against one tab (variables `p`, `sleep`, `shot`, `fs`, `TMP`). Keep throwaway scripts in the temp directory, not in the repo.
- `node scripts/resume-pdf.mjs` renders `source/cv*.md` to ATS-named PDFs with the redaction rules applied; upload those, not hand-made files.

## Note template

```markdown
# <Site>
- Auth: how a session looks when logged in; what the tools may and may not do.
- URLs: stable paths for view / edit / search (no ids that belong to one person).
- Data model: sections, which fields exist, which do not (so nobody searches for a field that is not there).
- Limits: lengths, sizes, formats; what happens when exceeded (error or silent failure).
- Recipes: step list that worked, with selectors/labels.
- Dead ends: what failed and why.
- Verified: date and what was verified live.
```
