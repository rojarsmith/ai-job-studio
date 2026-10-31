# Mode: seed

Derive `source/cv.md` (and translations) from the human's hand-written material in `original/`. Run it when the originals change. You only read and write text files inside the workspace. No web, no browser.

Workspace: `node scripts/workspace.mjs path`. Run `node scripts/seed-prep.mjs` first: it lists the files you may read and backs up the `source/cv*.md` files this mode replaces.

## Rules

1. `original/` is read only. Never create, edit or delete anything in it.
2. Overwrite `source/cv.md` (and `source/cv.<lang>.md` when an original is in another language, for example `cv.zh-TW.md`). The human asked for replacement, and `seed-prep` saved the old copies in `generated/data/seed-backup/`. Do not touch any other file in `source/`.
3. The originals are the only evidence. Never invent or round a skill, employer, date, title, degree or number. If an original is ambiguous (missing month, unclear title), keep it as written and list the question under "Open questions" in your final message instead of guessing.
4. Rewrite, do not summarise away: keep every distinct fact and number. Merge duplicates, fix grammar, turn notes into bullets that start with a verb and end with the result.
5. A translation carries identical facts. Do not add or drop anything between `cv.md` and `cv.<lang>.md`.
6. Follow the shape in `examples/workspace/source/cv.md` (its comments hold the rules): H1 name, contact line, H2 sections from Summary / Skills / Experience / Education / Certifications / Projects / Publications / Languages / Awards (or the zh-TW forms), every role `### Company — Title` with one date line `YYYY-MM to YYYY-MM|present`, newest first. No tables, images, HTML, emoji or columns.
7. Contact details come from the originals; if absent, take them from `source/profile.yml`.

## After writing

Run `node scripts/ats-check.mjs --file <workspace>/source/cv.md` and fix every PROBLEM line in the file you just wrote. Final message: files written, the backup folder, and the open questions.
