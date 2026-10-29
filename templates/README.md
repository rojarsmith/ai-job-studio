# Templates

Default stylesheets for S3 output. Any file with the same name in `<workspace>/templates/` wins.

| File | Used for | Limits enforced by `check-pdf` |
| --- | --- | --- |
| `resume.css` | `applications/NNN/cv.md` → `cv.pdf` | ≤ `thresholds.tailor.cv_max_pages` (default 2), contact info in text layer, name before first heading |
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

Fonts: Chrome embeds whatever system font matches. For CJK names, keep a CJK-capable family in the stack (the defaults include Noto Sans CJK TC and Microsoft JhengHei).
