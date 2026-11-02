# Yourator (yourator.co)

Verified live 2026-11-02. Taiwan start-up job board; most employers are small, so the Taiwan-listed filter (`require_listed: tw`) drops most rows.

- **Auth**: none for search or reading. Applying needs a Yourator account or goes to the employer's own site (`thirdPartyUrl`, often a teamdoor.io page); the adapter does discovery and scoring only.
- **Public JSON API, no login, no bot challenge**: `https://www.yourator.co/api/v4/jobs?term[]=<keyword>&page=<n>&sort=recent_updated`. `payload.jobs` has 20 rows (`id`, `name`, `path`, `salary`, `location`, `company.brand`, `lastActiveAt`, `thirdPartyUrl`); `payload.hasMore` / `nextPage` drive paging. There is no description and the updated label is relative ("一天內更新").
- **Detail**: the job page `https://www.yourator.co/companies/<company>/jobs/<id>` (HTTP 200) carries one JSON-LD `JobPosting` (title, HTML description, `datePosted`, location, employer). `/api/v4/jobs/<id>` and `/api/v4/companies/<x>/jobs/<id>` return 404. A removed job returns 404 from the page.
- **Location** is the city only ("臺北市", "新北市"); it uses 臺, so list both 臺 and 台 spellings in `locations`.
- **Pay** is free text ("面議（經常性薪資達4萬元）", "年薪 120~150萬"); score unknown pay as 3.
- **Cost**: about one request per page; no detail call until a row passes the title screen.
- **Applying needs a Yourator account**: the job page's 立即應徵 / "Apply now" links to `<job page>/check_resume`, which redirects to `/users/sign_in` ("您必須要登入才能投遞") unless the attached Chrome is logged in (Google, LinkedIn, Facebook or email). Some jobs hand off to the employer's own page (`thirdPartyUrl`, often teamdoor.io). The tools do not log in for the person, so a tailored row for Yourator waits until they sign in.
