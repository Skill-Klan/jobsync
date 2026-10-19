# SkillKlan JobSync

Job search tracker with AI assistance for SkillKlan students and graduates — applications, resumes,
contacts, interviews and automated job discovery. Served at `jobs.skillklan.com.ua`.

This is a **modified version of [JobSync](https://github.com/Gsync/jobsync)** by gsync, used under the
MIT License (see [`LICENSE`](./LICENSE), which must stay in this repository and in the image). Since
2026-10-14 it is developed independently and does not track upstream.

## What differs from upstream

- **Own container image** ([`Dockerfile`](./Dockerfile)): base image pinned by digest, runs as uid 1001
  from the start, Prisma CLI baked in (no downloads at startup), and the entrypoint
  ([`skillklan/docker-entrypoint.sh`](./skillklan/docker-entrypoint.sh)) refuses to start without a real
  `AUTH_SECRET` and `ENCRYPTION_KEY`.
- **Sign-in through the SkillKlan cabinet** ([`src/skillklan/`](./src/skillklan/)): the cabinet posts a
  one-time code to `/auth/cabinet`, the server trades it at the SkillKlan backend and re-checks access at
  least every 5 minutes (fail closed). Own sign-up and password sign-in are off in production builds. The cabinet
  opens SkillKlan Job in its own tab (`/auth/cabinet` answers 303 → `/dashboard`, so Back returns to the cabinet),
  and the menu has «Кабінет» back to `CABINET_URL` (an http(s) address only; unset → no item).
- **Ukrainian interface** with an English switch; the MCP server is removed.
- **SkillKlan admin API** — numbers for the admin pages of the SkillKlan cabinet (see below).
- **Who comes in:** students, the admin and the QA moderator (the backend's roles `student`, `admin`,
  `qa_moderator`); the QA moderator has the admin's rights here (owner 2026-10-19).
- **Feature switches** — the admin or the QA moderator turns parts of the app on or off for everyone in Settings → «Функції»
  (see below). Automations (with notifications), Activities and the Library are off.
- **Interview recordings library** — «Співбесіди» plays the recordings students upload through the SkillKlan
  Telegram bot, straight from Google Drive, and shows the files lying next to them (see below).
- **Removed:** upstream deploy scripts (`curl | bash`), compose files with placeholder secrets, release and
  wiki workflows, Jenkinsfile, `evals/`.
- **Planned:** AI usage billing on the SkillKlan side.

## SkillKlan admin API

The SkillKlan backend reads per-person numbers for the cabinet's "Статистика Job" pages from a machine API
([`src/skillklan/adminApi.ts`](./src/skillklan/adminApi.ts), [`src/skillklan/adminStats.ts`](./src/skillklan/adminStats.ts)):

| Request | `data` |
|---|---|
| `GET /skillklan/admin/stats` | `{ users, unlinkedAccounts, generatedAt }` — everyone who came in from the cabinet |
| `GET /skillklan/admin/stats/:cabinetUserId` | `{ user \| null, generatedAt }` — never came in → `null`, not 404 |

- **Numbers only** per person: jobs (total, marked applied, per status), interviews (interview stages,
  counted as the old Interviews list did), resumes, cover letters, automations (and active), tasks, activities, contacts, questions, first
  and last sign-in. No job titles, companies, notes or resume text.
- **Outside `/api` on purpose** (like `/auth/cabinet`): the session middleware never sees these routes; the
  only way in is the `X-Jobsync-Admin-Secret` header equal to `JOBSYNC_ADMIN_API_SECRET` — a different secret
  from `JOBSYNC_API_SECRET`. Unset or shorter than 32 characters → `503`, wrong → `401`; constant-time compare;
  `Cache-Control: no-store`.
- `User.lastLoginAt` is stamped on every cabinet sign-in — a sign-in, not "last seen": the session slides,
  8 hours from the last request, so someone who works every day may not sign in again for days.
- The contract lives with its consumer: the SkillKlan backend's `documentation/05-api/JOBSYNC_ADMIN_API.md`.

## Feature switches («Функції»)

An admin turns parts of SkillKlan Job on or off **for everyone** — the admin included, so the admin sees what
students see — in Settings → «Функції». Code: [`src/skillklan/features.ts`](./src/skillklan/features.ts),
[`src/skillklan/featureFlags.ts`](./src/skillklan/featureFlags.ts),
[`src/actions/featureToggles.actions.ts`](./src/actions/featureToggles.actions.ts).

- **The list and the defaults live in code** (`FEATURES`); the `FeatureToggle` table keeps only the admin's
  choices (`updatedByCabinetUserId` — who). No row → the default. Adding a switch is a code change.
- **The admin and the QA moderator only** (`managesSkillklanJob`: roles `admin`, `qa_moderator`). The role is
  the SkillKlan backend's: taken at sign-in, refreshed by the ≤ 5-minute access re-check, kept in the session
  token only (no role copy in the database). The settings page shows «Функції» to them only; a change asks the
  backend again at that moment (`confirmCabinetAdmin`) — a token minted before a demotion is not enough.
- **Hidden, not deleted.** A switched-off part disappears from the menus, its page answers 404, the dashboard
  and other pages drop its blocks, and **every server action that changes it refuses** (a page opened before
  the switch went off keeps its buttons until reloaded). Data stays; switched back on, it is all there.

| Switch | Default | Off means |
|---|---|---|
| `automations` | off | no Automations tab/pages, no "Add Automation" on the dashboard, no "accepted (discovered)" / "include dismissed" job filters; the scheduler runs nothing; notifications (all of them are about automation runs) go too — no bell, no Notifications item or page, no unread summary request; the 10 automation-changing actions, `run` / `cancel` / `logs/clear` (403) and the 6 notification-changing actions refuse |
| `activities` | off | no Activities tab/page, no running-activity banner, no "Start activity" / "Save & Start" in Tasks; the dashboard shows applications only (no hours card, activity chart or calendar, recent activities, "Add Activity", hours goal ring); goal days and streaks count applications alone; the 8 activity-changing actions refuse |
| `library` | off | no Library tab/page, company pages answer 404 and company names in job lists and a job's header are plain text; the 14 actions only the Library uses (edit/delete/watch) refuse. Creating on the fly from forms — a company, title, skill, role, activity type — stays open, so the lists keep filling up |

## Interview recordings library

«Співбесіди» is a library of every interview recording students uploaded through the SkillKlan Telegram bot
— for everyone SkillKlan Job lets in (an excluded student is out within 5 minutes). **Listening only:** no
download button, `Content-Disposition: inline`, the player without its download menu and context menu.
Uploads stay with the bot; this app only reads Google Drive. Code:
[`src/skillklan/interviewRecordings.ts`](./src/skillklan/interviewRecordings.ts),
[`src/skillklan/recordingName.ts`](./src/skillklan/recordingName.ts),
[`src/app/api/skillklan/interview-recordings/`](./src/app/api/skillklan/interview-recordings/).

- **Read-only access:** a Google service account with `drive.readonly` (a JWT signed with node `crypto`, no
  Google library). Nothing of Google's reaches the browser — the server streams each file, passing the
  browser's `Range` to Drive, so seeking works.
- **The library is every reviewed recording.** On Drive each kind of interview (QA and BA × recruiter,
  technical, manager) has a folder with a folder per company inside. The bot uploads into one more folder there
  («pending for review»), and the team moves a recording into its company's folder once reviewed. So for each
  of the bot's six upload folders the library takes its parent with everything under it — except the upload
  folder itself. Audio and video only, newest interview first, cached for 5 minutes. A file outside the library
  (waiting for review, or anywhere else) is never served (404).
- **What a row shows:** kind — from the kind folder; company — from the company folder; date, specializations
  and the uploader's name — from the bot's file name `дата - [спеціалізація - ]хто - компанія.ext`. Older names
  are shown as they are, with the date taken from them when there is one (`…_дд.мм.рр`); no date → «Без дати»,
  after the dated ones (most of the archive was uploaded on one day, long after the interviews).
- **Finding one** ([`src/skillklan/recordingsLibrary.ts`](./src/skillklan/recordingsLibrary.ts)): first the
  folders of the companies — one per company however its name is spelled in different Drive folders, the most
  recorded first (or A–Z); inside, the recordings by stage (recruiter → technical → manager), a candidate's
  sub-folder nested. «All recordings» is the plain list. Filters: direction (QA / BA), stage (several at once),
  company (a searchable list), search (name, person, company, sub-folder); each option shows how many it gives.
  The filters live in the page address (`?dir=qa&stage=tech&company=privatbank&open=…&view=all&sort=name`), so a
  link opens the same selection; unknown values in a link are dropped. Searched in Ukrainian (Cyrillic in the query) →
  a hint to try English: most names are in Latin letters (127 of 135 company folders) — also when the company list
  finds nothing in Ukrainian.
- **Attachments** — files lying next to the recordings in the company folders (a picture of a task, a PDF, notes;
  [`src/skillklan/recordingAttachments.ts`](./src/skillklan/recordingAttachments.ts),
  [`src/skillklan/attachmentContent.ts`](./src/skillklan/attachmentContent.ts)). Drive ties a file to a folder,
  not to another file, so one goes **beside a recording only when that is certain** — the folder holds one
  recording, or the file's name starts with exactly one recording's name — and on its folder (the company's
  stage, a candidate's sub-folder) otherwise. **Viewed, not downloaded:** the server sends a form to show, made
  from the file — a picture re-encoded (no EXIF, so no phone GPS), a PDF as is, a Google document exported to
  PDF, a Word document as a page (no scripts, nothing from elsewhere), text and code as text; the page draws
  pictures and PDF pages (pdf.js) on a canvas. Spreadsheets, presentations, archives are listed, not shown.
  `GET /api/skillklan/interview-recordings/attachments/:id` answers only the page (`x-skillklan-viewer: 1`;
  without it 400), always `inline`, `nosniff`, `CSP: sandbox`. A screenshot is still possible.
- **Not configured → the page says «Записи співбесід ще не підключено.»** The person's own interview stages are
  on each job's «Етапи» tab; the old interviews list (`InterviewsContainer`) is in the code, not shown.

### Turning it on

1. Google Cloud: enable the Drive API, create a service account (no roles), create a JSON key.
2. Google Drive: share the folders that hold the bot's six upload folders (the QA and the BA interview folders)
   with the service account's email as **Viewer**.
3. `app.env` on the server:

   | Variable | Value |
   |---|---|
   | `INTERVIEW_RECORDINGS_SERVICE_ACCOUNT_JSON` | the JSON key, as is or base64 |
   | `INTERVIEW_RECORDINGS_FOLDER_QA_RECRUITER` | the bot's `GOOGLE_DRIVE_FOLDER_ID_HR` |
   | `INTERVIEW_RECORDINGS_FOLDER_QA_TECH` | the bot's `GOOGLE_DRIVE_FOLDER_ID_TECH` |
   | `INTERVIEW_RECORDINGS_FOLDER_QA_MANAGER` | the bot's `GOOGLE_DRIVE_FOLDER_ID_MANAGER` |
   | `INTERVIEW_RECORDINGS_FOLDER_BA_RECRUITER` | the bot's `GOOGLE_DRIVE_FOLDER_ID_BA_RECRUITER` |
   | `INTERVIEW_RECORDINGS_FOLDER_BA_TECH` | the bot's `GOOGLE_DRIVE_FOLDER_ID_BA_TECH` |
   | `INTERVIEW_RECORDINGS_FOLDER_BA_MANAGER` | the bot's `GOOGLE_DRIVE_FOLDER_ID_BA_MANAGER` |

4. Run the deploy with the digest that is already running (see below): the container reads `app.env` only
   when it is created, and the deploy redeploys the same digest when `app.env` changed. Check: «Співбесіди»
   lists the recordings, one plays and seeks, there is no download.

Replacing the key later is the same: new key into `app.env`, deploy the running digest, then delete the old
key in Google Cloud.

## Development

```sh
npm ci
npx prisma generate
npm run dev        # http://localhost:3737
npm run lint
npm test
```

## Image and release

- [`.github/workflows/skillklan-image.yml`](./.github/workflows/skillklan-image.yml) builds the image on every
  pull request into `main` and runs [`skillklan/tests/image-smoke.sh`](./skillklan/tests/image-smoke.sh)
  (requirements R1–R5: starts without network, non-root, migrations applied, placeholder or empty secrets
  refused). The same script must fail on the original upstream image — a guard against a vacuous test.
- Images are published only for `sk-*` tags to `ghcr.io/skill-klan/jobsync` and deployed **by digest**:
  [`.github/workflows/skillklan-deploy.yml`](./.github/workflows/skillklan-deploy.yml) (manual run with the
  digest) asks the owner in Telegram first, then the server copies `/data`, starts the new image and rolls
  back — image and data — if it is not healthy within 3 minutes. A merge into `main` deploys nothing.
- The same digest again is a no-op — unless `app.env` changed since the last deploy (the wrapper keeps its
  sha256, never the values): then it is redeployed the same way, so new settings reach the container.

## License

MIT. Original work © 2024 gsync (JobSync). Modifications © SkillKlan. See [`LICENSE`](./LICENSE).
