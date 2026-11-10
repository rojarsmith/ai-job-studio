# Mode: tailor (S3)

Two roles, two separate contexts. The **drafter** writes; the **reviewer** checks the drafter against the evidence and may remove claims. Run the reviewer as a fresh subagent that has NOT seen the drafter's reasoning. You only write text files inside the workspace. No web, no browser, no submitting.

Workspace: `node scripts/workspace.mjs path`. Targets: `node scripts/tailor-prep.mjs` lists `generated/applications/NNN/` folders with a `brief.md`. Write only under `generated/`; `source/` is the human's.

## Inputs (per application NNN)

- `<workspace>/generated/reports/NNN-*.md` — job text, score, knock-outs, existing `## Gaps`.
- `<workspace>/source/cv.md` — the only evidence. A fact that is not here does not exist. If the posting is in another language and `source/cv.<lang>.md` exists (for example `cv.zh-TW.md`), draft from that file; the facts are the same, the wording is already in the right language.
- `<workspace>/source/profile.yml` — contact line, location, languages.
- `<workspace>/source/answers.md` — shared facts (read only). `<workspace>/generated/applications/NNN/answers.md` — per-job override created by tailor-prep; the only answers file you write.

## Drafter

Write `applications/NNN/cv.md` and `applications/NNN/cover.md` in the markdown shape described in `templates/README.md` (H1 name, contact line, H2 sections, H3 roles with a meta line, bullets with numbers). `node scripts/ats-check.mjs NNN` tells you what an ATS parser will reject; run it after drafting and fix every PROBLEM line.

Rules:
1. Reorder and reword `cv.md` content to match the posting. Never invent a skill, employer, date, title, degree or number. Every bullet must be traceable to a line in `cv.md`.
2. Use the posting's vocabulary only where `cv.md` supports it. If the posting wants "Kubernetes" and `cv.md` says "deployed services on k8s", say Kubernetes. If `cv.md` has nothing, leave it out.
3. Resume ≤ 2 pages, cover letter ≤ 1 page at the default stylesheet. Cut the least relevant roles first.
4. Cover letter: 3 to 4 short paragraphs; why them, two or three concrete matches with evidence, how you would approach the role's stated priorities (built only from strengths `cv.md` supports), close. No flattery.
   Never volunteer a gap. Do not name a missing skill, a shortfall in years, team size or scale, or an unmet requirement, and do not hedge or apologise ("to be candid", "although I lack", "I have not yet", "坦白說", "雖然我沒有", "我尚未", "經驗較少"). A screener reads that sentence as the reason to reject. Gaps stay in `review.md` and the report's `## Gaps` for the human, who answers them in the interview. Being truthful means claiming nothing `cv.md` does not support, not listing what it lacks. A fact the employer needs (work authorization, relocation, notice period) gets one neutral sentence only when the posting or form asks for it. `ats-check` fails a cover letter that hedges.
5. Fill the free-text drafts in `generated/applications/NNN/answers.md`. Never edit `source/answers.md` or lines marked `needs_confirmation`.
6. Keep the same language as the posting unless `profile.yml` says otherwise.
7. ATS shape: H2 headings only from Summary / Skills / Experience / Education / Certifications / Projects / Publications / Languages / Awards (or their zh-TW forms). Every role `### Company — Title` with a date line `YYYY-MM to YYYY-MM|present`, one format throughout, newest first. No tables, images, HTML, emoji or columns.
8. Every keyword the reviewer will mark `supported` must appear verbatim (or by common alias: k8s ↔ Kubernetes) in `cv.md`. `ats-check` fails the draft otherwise.

## Reviewer (fresh context)

Read the posting in the report, `cv.md`, and the drafter's `cv.md` / `cover.md`. Write `applications/NNN/review.md`:

```markdown
# Review NNN

| keyword | evidence | verdict |
| --- | --- | --- |
| Go | cv.md: "Gitaly storage service in Go (2022–2024)" | supported |
| Kafka | none in cv.md; removed from cv.md line 31 | removed |
| CKA certification | none in cv.md | gap |

## Changes made
- removed "Kafka" from Skills (no evidence)
- softened "led" → "co-led" in Experience/Acme (cv.md says co-led)

## Summary for the human
Two sentences: how well the draft fits, what was removed, what remains a gap.

verdict: pass
```

- Extract every hard-skill / tool / certification / seniority keyword from the posting as a row. Verdict `supported` needs a quote or close paraphrase from `cv.md`. `removed` means the drafter claimed it and you deleted it from the draft. `gap` means the posting wants it, `cv.md` has nothing, and the draft correctly does not claim it.
- You MAY edit `cv.md` / `cover.md` in the application folder to remove unsupported claims, and to delete any sentence in `cover.md` that volunteers a gap or hedges (drafter rule 4). You may not add content.
- `verdict: fail` only if an unsupported claim remains after your edits or the draft misstates a date, title or employer. Otherwise `pass`.
- Copy the final gap list into the report's `## Gaps` section.

## Then

```bash
node scripts/ats-check.mjs NNN        # sections, dates, layout, keyword coverage; no Chrome
node scripts/build-pdf.mjs NNN        # ats-check again, compile PDF + DOCX, PDF gate (pages, text layer, contact info, reading order), named copies
node scripts/tailor-apply.mjs NNN     # prints the summary for the human; the human approves with --ok
```

Report the last line of each command. Never run `tailor-apply.mjs --ok` yourself; that line is the human gate.
