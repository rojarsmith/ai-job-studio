# MyGreenhouse (my.greenhouse.io)

Verified live 2026-11-01. This is the candidate account that Greenhouse job boards use for Quick Apply; it is separate from an employer's own board.

- **Auth**: log in by hand. Nothing here stores or types credentials.
- **URLs**: `/dashboard`, `/profile` (one page of cards: About you, Employment, Education, Skills, Resume, Contact info, Online profiles, Work preferences, Voluntary self-identification). Each card has a button `Edit <card name>` that opens a modal with `Cancel` / `Save`.
- **Fastest path: upload the resume first.** `Edit resume` → `input[type=file]` → `setInputFiles(<pdf>)`, wait about ten seconds for the parse, then `Save`. The parser fills Employment (one role per job, the whole bullet list as the summary), Education, and the name, phone (`+<country> <number>`) and location in Contact info. Check the result: company names keep the resume's text, and capitalisation can be changed ("Simplo" came out lower-case). Upload the redacted PDF from `scripts/resume-pdf.mjs`, never the raw cv.
- **Not filled by the parse** (fill by hand): About you (`#about-you-bio`, plain textarea), Skills, Online profiles (`#linkedin`, `#github`, `#portfolio`, `#website`), Work preferences, Voluntary self-identification. Selectors here are `id`s; `name` attributes are empty.
- **Skills**: type into `#skills-input`, click `Add`; **the limit is 25** (the tags beyond it are refused with "Skill limit reached"). Clear the input before `Save`.
- **Work preferences**: Location (one value; autocomplete returns city names such as "Kaohsiung City, Taiwan", type slowly with `pressSequentially` and click the option), "willing to relocate" checkbox, Minimum salary (USD buckets from "< $40,000" to "$200,000+"), Work type (On site / Hybrid / Remote, multi), Employment types, Languages spoken (up to 5), Desired job title (`#desired_job_title` + `Add`, **up to 3**).
- **Voluntary self-identification**: Gender, Hispanic or Latino, Veteran status, Disability status. Legal or personal declarations; fill only what the person has stated in `profile.yml` and leave the rest.
- **react-select widgets**: ids are `react-select-<counter>-input` and the counter changes on every open, so address them by order inside the open modal: `locator('input[id^=react-select]').nth(i)`, `click()`, `fill(text)`, click `getByRole('option', {name, exact:true})`. Pressing `Escape` on one can close the whole modal.
- **Dead ends**: selecting inputs by `name` (empty); fixed react-select ids; adding more than 25 skills or 3 titles.
