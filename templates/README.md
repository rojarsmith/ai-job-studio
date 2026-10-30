# Templates

Default stylesheets for S3 output. Any file with the same name in `<workspace>/templates/` wins.

| File | Used for | Limits enforced by `check-pdf` |
| --- | --- | --- |
| `resume.css` | `applications/NNN/cv.md` → `cv.pdf` | ≤ `thresholds.tailor.cv_max_pages` (default 2), contact info in text layer, name before first heading, plus the ATS text checks below |
| `cover.css` | `applications/NNN/cover.md` → `cover.pdf` | ≤ `thresholds.tailor.cover_max_pages` (default 1), contact info in text layer |

Markdown conventions the stylesheet expects:

```markdown
# Full Name
email · phone · city · linkedin-or-site        ← first paragraph after the H1 is the contact line

## Summary
## Skills
## Experience
### Company — Title
2021-03 to 2024-06 · Taipei                   ← first paragraph after an H3 is the meta line
- achievement with a number
## Education
```

ATS text checks (`scripts/ats-check.mjs`, also run inside `build-pdf` and `tailor-apply`) read the markdown, not the PDF:

- H2 headings must be standard names: Summary, Skills, Experience, Education, Certifications, Projects, Publications, Languages, Awards (zh-TW: 摘要, 技能, 工作經歷, 學歷, 證照, 專案 …). Skills and Experience are required.
- Every role is `### Company — Title` followed by a date line `YYYY-MM to YYYY-MM|present`. One date format for the whole file, newest role first. Year-only dates are allowed but noted.
- No tables, images, raw HTML, emoji or multi-column text. The DOCX writer ignores them too.
- Keyword coverage: the share of `review.md` keywords the draft mentions must reach `thresholds.tailor.keyword_coverage_min`; a keyword the reviewer marked `supported` that the draft never mentions is a problem.
- `build-pdf` also writes `cv.docx` / `cover.docx` (no stylesheet; Title / Heading 1 / Heading 2 / List Paragraph styles) and copies everything to `<Name>-<Title>-CV.pdf` etc. `apply` uploads those names.

Fonts: Chrome embeds whatever system font matches. For CJK names, keep a CJK-capable family in the stack (the defaults include Noto Sans CJK TC and Microsoft JhengHei).
