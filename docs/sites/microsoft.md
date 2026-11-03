# Microsoft Careers (apply.careers.microsoft.com)

Verified live 2026-11-03. The careers site is an Eightfold instance; `careers.microsoft.com` is the marketing shell, every job and
form lives under `apply.careers.microsoft.com`. The old `jobs.careers.microsoft.com/global/en/search` URLs and the
`gcsservices.careers.microsoft.com/search/api/v1/...` endpoints redirect or fail: do not use them.

- **Auth**: log in by hand in the attached Chrome (Microsoft account). A logged-in account without a profile sees only a "Create
  your profile with existing information" dialog and the page stays on "Profile Bootstrapping"; search, the API and the job
  pages all stay dead until the profile exists. The dialog accepts a resume (`input[type=file]`, hidden, `.pdf,.doc,.docx,.txt,.rtf`)
  and then shows a short form (preferred first / last name, phone with country-code picker, country of residence) with `Back` /
  `Submit`; it parsed name, phone and country from the uploaded PDF correctly. Use `node scripts/resume-pdf.mjs` output for the upload.
- **URLs**: job `https://apply.careers.microsoft.com/careers/job/<position id>` (19-digit Eightfold id; the "Job number" shown on the
  page is `displayJobId`, e.g. 200051875). Search UI `…/careers?query=<q>&location=<loc>&start=<n>&sort_by=relevance&filter_include_remote=1`.
- **API (the site's own, called from a page of the attached Chrome)**: `GET /api/pcsx/search?domain=microsoft.com&query=<q>&location=<loc>&start=<n>&sort_by=relevance&filter_include_remote=1`
  returns `{status, error, data:{count, positions:[{id, displayJobId, name, locations[], standardizedLocations[], postedTs, department, workLocationOption, positionUrl}]}}`,
  10 per page (`num` is ignored; page with `start`). `GET /api/pcsx/position_details?position_id=<id>&domain=microsoft.com&hl=en`
  adds `jobDescription` (HTML), `publicUrl` and the custom fields `efcustomTextRoletype` (Individual Contributor / People Manager),
  `efcustomTextWorkSite` (Fully on-site / 3 days a week in-office / Up to 50% work from home …), `efcustomTextCurrentProfession`,
  `efcustomTextTaDisciplineName`, `efcustomTextEmploymentType`, `efcustomTextRequiredTravel`. Every call needs the headers
  `X-CSRF-Token` and `X-Browser-Request-Time` the page sends; the token is not in a cookie, meta tag, localStorage or a window
  global, so `adapters/microsoft.mjs` reads it from the first `/api/pcsx/` request the page makes (CDP `Network` domain) and
  then calls the API with `fetch` inside that tab. Without the token the API answers `403 {"message": "Not authorized for PCSX"}`.
- **Location strings** that work in `location=`: `Taiwan`, `Tokyo, Japan`, `Mountain View, California, United States`,
  `Sunnyvale, California, United States`, `San Francisco, California, United States`. With `filter_include_remote=1` the US
  searches also return remote-eligible postings; a posting lists every site it can be worked from (`locations`).
- **Scale**: Taiwan has a few dozen postings in total (query `""` lists them all); a single title keyword returns tens of postings in a US hub. Several keywords × several locations × three pages take a few minutes.
- **Patchright**: `connectOverCDP` hung on this Chrome (see 104.md); `lib/cdp.mjs` is the raw-CDP path the adapter uses. It opens
  its own tab and closes it at `shutdown()`.
- **Apply flow** (verified 2026-11-03): `Apply now` is a plain link to `/careers/apply?pid=<position id>`; the
  form is one long page with a side nav: Application location(s), Resume, Contact Information, (Work Authorization - <country>
  and Self-identification appear only after a location is chosen), Candidate questions, Job specific questions, Acknowledgment,
  then `Submit application`. Success lands on `/careers/apply/success?…&pid=<id>` with "Your application has been submitted".
  - *Resume*: the profile resume is preselected; a hidden `input[type=file]` accepts a new one (`DOM.setFileInputFiles`). Uploading
    re-parses the file and **clears Address / City / Postal Code**, so upload first and fill the address afterwards. For U.S.
    postings the form asks that the resume carry no age, date of birth or graduation dates: drop the dates under Education.
  - *Application location(s)*: a multi-select combobox (`input[role=combobox]`, `aria-controls` → `<ul>` of `button[role=option]`).
    `.click()` on the option does nothing; a real mouse click (CDP `Input.dispatchMouseEvent` at the option's box) selects it. Each
    selected location becomes a chip with `button[aria-label="Remove <location>"]`. Typing in the box filters; stray keys plus
    Enter add the highlighted (first) location. The input's own `value` stays empty even when chips exist.
  - *Single-value comboboxes* (legal-name question, State, work authorization, self-identification, candidate questions): same
    widget. `.click()` on the option does not commit; keyboard typing + Enter leaves a "1 match found" filter and the form rejects
    it at submit with "Error: Select a value." What works: focus the input, Ctrl+A Delete to clear any filter text, click the arrow
    button next to it, then mouse-click the `button[role=option]` whose text equals the value. Earlier answers to the legal-name,
    candidate and self-identification questions are remembered across applications; the address is not.
  - *Address / City / Postal Code*: CDP `Input.insertText` leaves the DOM value set but the form state empty ("cannot be left
    blank" stays). Setting the value through the native setter (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,
    'value').set`) followed by `input` and `change` events registers it; ids are stable (`Contact_Information_q_address`,
    `Contact_Information_q_city`, `Contact_Information_q_zip`).
  - *Job specific questions*: radio groups named `Job_specific_questions_<jobId>_<n>`; so far always the posting's minimum
    qualification restated as a yes/no. Clicking the label works. *Acknowledgment*: three required checkboxes
    (`Acknowledgment_q_cust_disclaimer`, `…disclaimer2`, `…Candidatecodeofconduct`).
  - Validation messages are `[role=alert]` elements; `Submit application` is never disabled, it just refuses while alerts exist.
  - The session can drop between applications (the header shows "Sign in"); the person signs in again by hand.
- **Dead ends**: `jobs.careers.microsoft.com/global/en/search?…` redirects to the new site and shows nothing; `gcsservices`
  search API fails from the page (CORS) and from Node; `/api/apply/v2/jobs?domain=microsoft.com` (generic Eightfold endpoint) answers
  403 "Not authorized for PCSX"; `document.body.innerText` on this site drops every letter "s" (a font trick), so match on
  `textContent` or on the DOM, not on `innerText` strings.
