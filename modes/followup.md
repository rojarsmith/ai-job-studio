# Mode: followup (S7)

Write follow-up messages for drafts in `<workspace>/data/followups.md` whose `status:` is `draft` and whose `### Draft` section still holds the placeholder. You write text only; the human decides whether and where to send it. Workspace path: `node scripts/workspace.mjs path`.

For each draft:

1. Read the matching report `<workspace>/reports/NNN-*.md` (role, company, score rationale) and `<workspace>/applications/NNN/cover.md` (what was already said).
2. Replace the placeholder under `### Draft` with 4 to 6 sentences in the posting's language:
   - reference the role and the application date,
   - one new, specific proof point from `cv.md` that the cover letter did not use,
   - one concrete question (timeline, next step, or whether the role is still open),
   - polite close. No pressure, no flattery, no "just checking in".
3. Day-14 drafts are shorter than day-7 drafts and acknowledge the earlier note.
4. Do not change `status:`; the human marks sent or skipped with `node scripts/followup.mjs --sent NNN DAY`.
