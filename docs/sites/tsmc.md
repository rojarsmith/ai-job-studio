# TSMC Careers (careers.tsmc.com)

Verified live 2026-10-31 (English UI, `en_US`). The platform looks like Avature: `SearchJobs`, `JobDetail?jobId=N`, numeric form field names.

- **Auth**: log in by hand. When logged in the header shows the candidate name and a "My Profile" link. Nothing here stores or types credentials.
- **URLs**: `/en_US/careers/Profile` (read-only view, file Download/Delete, "Positions Applied" with "Update Application"), `/en_US/careers/ProfileEdit` (one long form, buttons `Cancel` / `Save`), `/en_US/careers/SearchJobs`, `/en_US/careers/JobDetail?jobId=<n>`. A permanent "Register your profile on TSMC Talent Pool" posting exists as a job detail.
- **Data model** (what the profile has): Personal Information, Resume Keywords, Work History rows, Education rows, Attachments. **There is no free-text description per job, no skills list, no summary.** The resume file is the only place for achievements, so keep the PDF current.
  - Personal: last name, first name, cell phone, second phone, email, second email, mailing address (single text field).
  - Resume Keywords: four free-text inputs, each a comma/、-separated list (used for TSMC's resume search). Several hundred characters are accepted per input.
  - Work History row: company (a `<select>` of known companies, not free text; an unlisted company shows a free-text input instead), location, job title, employment type, current employer yes/no, From/To as `<input type="month">` (`YYYY-MM`).
  - Education row: school (`<select>`), education level (`<select>`), major (free text), graduated yes/no, From/To months.
- **Field names** are `<formId>-<fieldId>-<rowIndex>` (seen as `3190-2-0` = work history, job title, row 0; `3188-1-<n>` keywords; `3192-1-<n>` major; `file_3194` resume). Ids may differ per tenant or after a redesign: find fields by label first, fall back to names.
- **Attachments**: all files together must stay under 30 MB; avoid uploading duplicates. Slots: Resume, Transcript of highest degree, Transcript of second-highest degree, Cumulative GPA, Language Proficiency Certificate, License / Certificate, Others (two). None blocks saving. Several resumes are allowed (for example one per language).
  - Upload: in `ProfileEdit`, `input[name="file_3194"].setInputFiles(<pdf>)`, then `Save`. The slot takes one file per save; repeat the visit to add another. Saving redirects to `/Profile`.
  - Delete: only on `/Profile`, link `Delete` next to a file. It opens a native `confirm()` dialog: register `page.on('dialog', d => d.accept())` before clicking. Reload to verify ("No attachments found").
- **Saving**: about 30 inputs are `required`; a profile that was complete before still saves. A failed save stays on `ProfileEdit` with inline errors.
- **Recipe: refresh the profile from a resume**: update the keyword inputs and any changed title/major/date fields in `ProfileEdit`; `node scripts/resume-pdf.mjs`; delete old resume files on `/Profile` (dialog); upload the new PDF(s) in `ProfileEdit`; reload `/Profile` and compare.
- **Dead ends**: looking for a work-description or skills field (does not exist). Deleting from `ProfileEdit` (only the "Uploaded files" dropdown is there; deletion needs `/Profile`).
