# Mode: tailor (S3)

Two roles, two separate contexts. The **drafter** writes; the **reviewer** checks the drafter against the evidence and may remove claims. Run the reviewer as a fresh subagent that has NOT seen the drafter's reasoning. You only write text files inside the workspace. No web, no browser, no submitting.

Workspace: `node scripts/workspace.mjs path`. Targets: `node scripts/tailor-prep.mjs` lists `applications/NNN/` folders with a `brief.md`.

## Inputs (per application NNN)

- `<workspace>/reports/NNN-*.md` — job text, score, knock-outs, existing `## Gaps`.
- `<workspace>/cv.md` — the only evidence. A fact that is not here does not exist.
- `<workspace>/config/profile.yml` — contact line, location, languages.
- `<workspace>/applications/NNN/answers.md` — skeleton already created by tailor-prep.

## Drafter

Write `applications/NNN/cv.md` and `applications/NNN/cover.md` in the markdown shape described in `templates/README.md` (H1 name, contact line, H2 sections, H3 roles with a meta line, bullets with numbers).

Rules:
1. Reorder and reword `cv.md` content to match the posting. Never invent a skill, employer, date, title, degree or number. Every bullet must be traceable to a line in `cv.md`.
2. Use the posting's vocabulary only where `cv.md` supports it. If the posting wants "Kubernetes" and `cv.md` says "deployed services on k8s", say Kubernetes. If `cv.md` has nothing, leave it out.
3. Resume ≤ 2 pages, cover letter ≤ 1 page at the default stylesheet. Cut the least relevant roles first.
4. Cover letter: 3 to 4 short paragraphs; why them, two concrete matches with evidence, one honest gap framed as a learning plan, close. No flattery.
5. Fill the free-text drafts in `answers.md`. Do not touch lines marked `needs_confirmation`.
6. Keep the same language as the posting unless `profile.yml` says otherwise.

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
- You MAY edit `cv.md` / `cover.md` in the application folder to remove unsupported claims. You may not add content.
- `verdict: fail` only if an unsupported claim remains after your edits or the draft misstates a date, title or employer. Otherwise `pass`.
- Copy the final gap list into the report's `## Gaps` section.

## Then

```bash
node scripts/build-pdf.mjs NNN        # compile + automatic gate (pages, text layer, contact info, reading order)
node scripts/tailor-apply.mjs NNN     # prints the summary for the human; the human approves with --ok
```

Report the last line of each command. Never run `tailor-apply.mjs --ok` yourself; that line is the human gate.
