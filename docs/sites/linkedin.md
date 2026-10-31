# LinkedIn

Verified live 2026-10-31 on a profile in English.

- **Auth**: log in by hand in the attached Chrome. Guest search from a script is rate-limited hard (HTTP 429); see the adapter notes.
- **Edit entry points**: the profile page has icon buttons with ARIA labels: `Edit intro`, `Edit about`, `Edit background image`, `Edit profile language`. Click by `[aria-label="Edit about"]`. Guessing `/in/<handle>/edit/about/` returns "This page doesn't exist".
- **Experience**: open `/in/<handle>/details/experience/`; each role has `a[aria-label^="Edit <title> at <company>"]` whose `href` is `/in/<handle>/details/experience/edit/forms/<positionId>/`. Collect the hrefs once, then `goto` each edit URL directly: a modal "Edit role" opens.
- **Fields are rich text**: About and the role description ("Highlights") are `contenteditable` divs, not textareas. Clear with `Control+A` then `Backspace`, **verify `innerText` is empty**, then `insertText`. With `Delete` the old text once stayed and the new text was appended.
- **Limits**: About 2,600 characters, role description 2,000. Over the limit the `Save` button gives no error and nothing is saved: count before saving, and reload the page to confirm.
- **Saving**: button `Save` (exact). Wait about 4 s, then reload and compare text. The "Notify network" toggle in the role modal defaults to Off; leave it.
- **Profile photo** shows in the intro card; `Edit intro` → photo. Not automated yet.
- **Featured** items (pinned media) keep their own text and are not touched by About/role edits.
- **Dead ends**: scraping the whole profile page text costs a lot; read the one section. The `/edit/about/` URL guess (above).
