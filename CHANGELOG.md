# Changelog

## SkillKlan releases

SkillKlan Job is developed independently since 2026-10-14 (see the README). **Since 2026-10-19 every push into
`main` is a release:** lint, tests and the image smoke test pass, the tested image is published to
`ghcr.io/skill-klan/jobsync` (tags `sha-<commit>` and `main`) and deployed **by digest** — the owner's pushes right
away, anyone else's after the owner's confirmation in Telegram. Those entries are by date and commit. Before that,
releases were the `sk-*` tags (sk-0.1.0 … sk-0.8.1), each confirmed in Telegram. Upstream JobSync's own history is
linked at the end.

### 2026-10-19 — `3058bc4`, `sha256:978de04f…40211`

* **A push into `main` is the release.** Lint and tests, the deploy scripts and the image build with its smoke
  test run in parallel; the image that passed smoke goes to Server2 by its digest. No tag and no second build of the
  same image: from push to production ~9 minutes.
* **The Telegram button only for others:** a push or merge by a login in the repository variable
  `DEPLOY_TRUSTED_ACTORS` deploys without it, anyone else's waits for the owner's press. A manual run of
  «SkillKlan deploy» with a digest still redeploys or rolls back; tick «ask» to get the button anyway.
* The app itself did not change in this release.

### sk-0.8.1 (2026-10-19) — `7a891cc`, `sha256:2bbbd7a0…08b0d`

* **The QA moderator works like the admin:** signs in with the cabinet's button and manages Settings → «Функції».
  The rest of the setup went out the same day: the backend issues them a sign-in code (`e97da22`), and the cabinet
  shows them the button (`4549029`). Mentors still don't get in.
* The texts say who can do it: «лише адміністратор і QA-модератор».

### sk-0.8.0 (2026-10-19) — `84beb7e`, `sha256:0441fe55…f9333`

* «Співбесіди» shows the **files lying next to the recordings** in the company folders: pictures, PDFs, documents.
  * Next to a recording only when that is certain: the folder holds one recording, or the file's name starts with one
    recording's name. Otherwise the files are listed for the whole folder, under the company's stage or a candidate's
    sub-folder.
  * Everyone who can listen to the recordings sees them too.
* **View only, no download:**
  * pictures are re-encoded without EXIF (no phone location) and turned upright;
  * PDFs open as is; Google Docs, Sheets, Slides and Drawings open as PDF pages;
  * Word files open as a page;
  * text and code open as text (the first 1 MB);
  * Excel and PowerPoint files and archives are listed as «Перегляд недоступний».
* There is no download button or context menu, and the file's address opened in a tab gets nothing.
* If the attachments list fails, only the attachments are missing; the library still works.

### sk-0.7.0 (2026-10-18) — `bb7fce3`, `sha256:a299837b…719fc`

* Two more switches in Settings → «Функції» (admin only, hidden for the admin too), **both off**:
  * **Automations** — with notifications, which are all about automation runs: no Automations tab or pages, no
    "Add Automation" on the dashboard, no bell or Notifications page, no "accepted (discovered)" / "include dismissed"
    job filters; the scheduler runs nothing. Due automations keep their next run and start on the first check after
    switching back on.
  * **Library** («Довідники») — no Library tab, company pages closed, company names in job lists and a job's header are
    plain text. Creating a company, title, skill, role or activity type from a form still works, so the lists keep
    filling up.
* A page opened before a switch went off keeps its buttons until reloaded — every change it would make is refused on
  the server, with "reload the page".
* Nothing is deleted: switched back on, it is all there.

### sk-0.6.1 (2026-10-18) — `586a434`, `sha256:41bd8c3a…6f7fb`

* Searched in Ukrainian → a hint to try English too: most names are in Latin letters (127 of 135 company folders —
  «PrivatBank», not «ПриватБанк»). The company list says the same when it finds nothing in Ukrainian, and opens with
  an empty search after a pick.
* **«Кабінет» in the menu** (side and phone): back to the SkillKlan cabinet in this same tab. The cabinet now opens
  SkillKlan Job in its own tab (cabinet `fa091cb`) — `/auth/cabinet` answers 303 → `/dashboard`, so Back returns to the
  cabinet too. The sign-in page's link to the cabinet is checked the same way (an http(s) `CABINET_URL` only).

### sk-0.6.0 (2026-10-18) — `721de50`, `sha256:4db7288b…addb9`

* «Співбесіди» opens **by company**: one folder per company, however it is spelled in different Drive folders; the
  most recorded first, or A–Z; inside, the recordings by stage — recruiter → technical → manager — with a candidate's
  sub-folder nested. «All recordings» is the plain list.
* **Filters**: direction (QA / BA), stage (several at once), company (a searchable list) and search; each option
  shows how many recordings it gives. The filters live in the page address, so a link opens the same selection.
* On a phone a row is the date, kind and ▶ on top, the name in full below.

### sk-0.5.1 (2026-10-18) — `a745ffc`, `sha256:30786596…8e706`

* The recordings library is **every reviewed recording**: the QA and BA company folders, not only the bot's
  «pending for review» folders (279 recordings instead of 4); recordings waiting for review are not shown or served.
  Company from its folder; dates also from the archive's own names (`…_дд.мм.рр`); undated ones after the dated.
* Deploy: deploying the digest that is already running redeploys it when `app.env` changed (the wrapper keeps the
  file's sha256, never the values) — new settings, like the recordings key, reach the container.

### sk-0.5.0 (2026-10-16) — `43097d4`, `sha256:46b397db…bd3c8`

* «Співбесіди» is the **interview recordings library**: every recording students upload through the SkillKlan
  Telegram bot, played straight from Google Drive through this server (seeking works) — for everyone SkillKlan Job
  lets in. Read-only access with a service account (`drive.readonly`); the six bot folders; newest first; filter by
  kind and search; date, kind, specializations, company and the uploader's name from the file name.
* **Listening only**: no download button, `Content-Disposition: inline`, no download in the player's menu or
  context menu.
* The page shows the library and nothing else (no «Мої співбесіди» tab); until Google Drive is connected it says
  «Записи співбесід ще не підключено.» The person's interview stages stay on each job's «Етапи» tab.
* README: feature switches, the recordings library and how to turn it on, the deploy pipeline; the SkillKlan admin
  API.

### sk-0.4.1 (2026-10-16) — `cb12545`, `sha256:06b87c3d…5214d`

* Activities switched off: the server refuses every change to them — add, delete, start, stop, breaks, start
  from a task — even from a page opened before the switch went off («Активності зараз вимкнено. Оновіть сторінку.»).

### sk-0.4.0 (2026-10-16) — `b0b0419`, `sha256:6395ffd5…ca8a0`

* **Feature switches** in Settings → «Функції», for admins only (the role is the SkillKlan backend's, checked
  again at the moment of a change). A switch hides a part of the app for everyone, the admin included; data is
  kept. New table `FeatureToggle`.
* **Activities off** by default: no Activities tab or page, no running-activity banner, no "Start activity" in
  Tasks; the dashboard is about applications only (no hours, activity chart or calendar, activity goal ring);
  goal days and streaks count applications alone.
* **SkillKlan admin API** (`/skillklan/admin/stats`): per-person numbers for the cabinet's «Статистика Job»
  pages, behind its own secret; `User.lastLoginAt`.

### sk-0.3.2 (2026-10-15) — `15f480f`, `sha256:f8b2342c…47f43`

* Dashboard quick action labels wrap instead of being cut.

### sk-0.3.1 (2026-10-15) — `897fc50`, `sha256:426a1b67…12217`

* Validation messages in Ukrainian, 24-hour time, fonts with Cyrillic in the interface and the PDF export,
  «AI» and «навички» terms, the last English texts translated.

### sk-0.3.0 (2026-10-15) — `b505505`, `sha256:85893a78…b87b6`

* Ukrainian interface with an English switch; the owner's glossary.

### sk-0.2.0 (2026-10-14) — `f155f32`, `sha256:bcab6ef6…803ad` — first in production

* Sign in from the SkillKlan cabinet with a one-time code (own sign-up and password sign-in off); access
  re-checked at least every 5 minutes, fail closed; the session slides, 8 hours from the last request.
* Deploy tooling: the Telegram gate, a copy of `/data` before each update, roll back on a failed health check.

### sk-0.1.0 (2026-10-14) — `8c151b7` — first published image, not launched

* Own image (non-root, refuses placeholder secrets), MCP removed, SkillKlan Job branding, Dependabot alerts 60 → 0.

## Upstream JobSync

The history of JobSync up to 1.1.22, the version this code base started from, is in the upstream repository:
[Gsync/jobsync CHANGELOG](https://github.com/Gsync/jobsync/blob/main/CHANGELOG.md).
