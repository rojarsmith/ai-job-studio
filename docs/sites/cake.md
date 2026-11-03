# Cake (cake.me)

Verified live 2026-10-31 on the profile page `https://www.cake.me/me/<username>`, Traditional Chinese UI.

- **Auth**: log in by hand in the attached Chrome.
- **Sections on the page**: intro card (name, headline, bio, location, links), 精選作品, 精選履歷, 專業背景 (current status, role, years, skill chips), 求職偏好, 工作經驗, 學歷, 資格認證.
- **Intro card**: the pencil at the top right of the card (about 1/3 down the page, no text label) opens a form: name, username, email, headline (頭銜), location, work eligibility, phone, bio (`<textarea>`), social links. Click it by position or find the small icon button; save with `儲存`. The bio is plain text, blank lines are kept.
- **Photo**: click the round avatar on the page (not the camera button, which is the cover image). A hidden `input[type=file]` appears; `setInputFiles`, then the "編輯圖片" crop dialog, button `儲存`. After reload the avatar is replaced.
- **Work entries**: each has a small edit button next to the role title. Company names show the *legal English* name Cake matched (for example "…CO., LTD."), not what the user typed: locate an entry by a distinctive English fragment, and by `locator('xpath=ancestor::*[.//button][1]').locator('button').first()`. The edit form opens inline with a `<textarea>` for the description (plain lines, no bullet characters) and the button **`更新`** (not 儲存). `getByText(role, {exact:true})` is not unique when several roles share a title.
- **Skills** are chips managed in 專業背景's own editor; not touched by the resume recipes.
- **Dead ends**: `button.WO_MtW_button` (a generated class) matched twelve unrelated buttons; do not select by it.

## Job search (verified 2026-11-02)

- **Search page vs. results**: `https://www.cake.me/jobs/<keyword>` is the search page, but the result cards are loaded by script after the page is open, and the same page also shows a "最近瀏覽" (recently viewed) list that looks like results. A URL whose slug matches nothing returns HTTP 404 with the recently viewed list only. Do not read cards from the DOM.
- **Search API**: `POST https://api.cake.me/api/client/v2/jobs/search` with `{"query": "<keyword>", "filters": {"job_source": ["cake","external"], "locations": ["Taiwan"]}, "sort_by": "popularity", "page": 1, "per_page": 20}`. Response: `total_entries`, `total_pages`, `data[]` with `path`, `title`, `description` (a short snippet), `locations[]` (district, city, country), `salary {min,max,currency,type}`, `seniority_level`, `number_of_management`, `min_work_exp_year`, `content_updated_at`, `page {path,name,country}`. `per_page` 20 works. `sort_by: "recent"` returned no `data`; use `popularity`.
- **Authorization**: the call needs the bearer token that the page attaches to every `api.cake.me` request (it is not in storage or in cookies the page can read). The adapter opens a tab in your Chrome, takes the header from the first `api.cake.me` request and calls the endpoint from inside that tab.
- **Job detail**: `https://www.cake.me/companies/<page.path>/jobs/<path>` has a JSON-LD `JobPosting` (full description, `datePosted`, employer). Its location is often only "台灣 台灣".
- **Employers**: foreign companies with a Taiwan office (Google, Micron, Applied Materials, Lam Research) post here, so `allow_companies` in `portals.yml` is how a US employer that is not TWSE / TPEx listed gets through `require_listed: tw`.
- **Applying**: the 應徵 control on an external posting leaves Cake for the employer's own site (Google, for example, needs its own account).
- **Cost**: one search per keyword, up to 4 pages of 20, runs in a few minutes for about ten keywords; most rows drop at the title screen and the listed / allow-list check.
- **Stale postings (2026-11-02)**: Cake can keep postings after the employer has removed them; the careers link `careers.google.com/jobs/results/<id>-<slug>/` then redirected to the general search list, and the employer's own search for the title found only other roles. For employers that post on their own site (Google, Micron and similar), check that the job is still listed there before tailoring a resume. The Cake page and its JSON-LD stay up and `detail()` cannot tell.
