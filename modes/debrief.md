# Mode: debrief (S8 after an interview)

For each `<workspace>/applications/NNN/interview.md` that has a `## Debrief <date>` section with the human's bullet notes still in skeleton form, expand it. Workspace path: `node scripts/workspace.mjs path`.

1. Turn the bullets into a short narrative: what was asked, what landed, what did not, what was promised.
2. Add `### Actions`: concrete follow-ups with dates (thank-you note, material to send, next round prep).
3. Add `### Lessons for the loop`: which `cv.md` lines were missing or weak, which answer in `modes/interview.md` prep was off, which question type was unexpected. Phrase each as a proposed edit to `cv.md`, a mode file, or `config/*.yml`. Do not apply edits yourself; the human decides.
4. If the human's notes say rejected or offer, remind them to run `node scripts/outcome.mjs NNN rejected|offer "<reason>"` so the retro sees it.
