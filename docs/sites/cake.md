# Cake (cake.me)

Verified live 2026-10-31 on the profile page `https://www.cake.me/me/<username>`, Traditional Chinese UI.

- **Auth**: log in by hand in the attached Chrome.
- **Sections on the page**: intro card (name, headline, bio, location, links), 精選作品, 精選履歷, 專業背景 (current status, role, years, skill chips), 求職偏好, 工作經驗, 學歷, 資格認證.
- **Intro card**: the pencil at the top right of the card (about 1/3 down the page, no text label) opens a form: name, username, email, headline (頭銜), location, work eligibility, phone, bio (`<textarea>`), social links. Click it by position or find the small icon button; save with `儲存`. The bio is plain text, blank lines are kept.
- **Photo**: click the round avatar on the page (not the camera button, which is the cover image). A hidden `input[type=file]` appears; `setInputFiles`, then the "編輯圖片" crop dialog, button `儲存`. After reload the avatar is replaced.
- **Work entries**: each has a small edit button next to the role title. Company names show the *legal English* name Cake matched (for example "…CO., LTD."), not what the user typed: locate an entry by a distinctive English fragment, and by `locator('xpath=ancestor::*[.//button][1]').locator('button').first()`. The edit form opens inline with a `<textarea>` for the description (plain lines, no bullet characters) and the button **`更新`** (not 儲存). `getByText(role, {exact:true})` is not unique when several roles share a title.
- **Skills** are chips managed in 專業背景's own editor; not touched by the resume recipes.
- **Dead ends**: `button.WO_MtW_button` (a generated class) matched twelve unrelated buttons; do not select by it.
