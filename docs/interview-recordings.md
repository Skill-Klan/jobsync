# Interview recordings library («Співбесіди»)

«Співбесіди» is a library of every reviewed interview recording students uploaded through the SkillKlan Telegram
bot — for everyone SkillKlan Job lets in (an excluded student is out within 5 minutes). Owner's decisions D57–D70,
D77–D80.

Code: [`src/skillklan/interviewRecordings.ts`](../src/skillklan/interviewRecordings.ts),
[`src/skillklan/recordingName.ts`](../src/skillklan/recordingName.ts),
[`src/skillklan/recordingsLibrary.ts`](../src/skillklan/recordingsLibrary.ts),
[`src/skillklan/recordingAttachments.ts`](../src/skillklan/recordingAttachments.ts),
[`src/skillklan/attachmentContent.ts`](../src/skillklan/attachmentContent.ts),
[`src/app/api/skillklan/interview-recordings/`](../src/app/api/skillklan/interview-recordings/).

## Rules

- **Listening only** (D58, D63): no download button, `Content-Disposition: inline`, the player without its download
  and context menus. Uploads stay with the bot; this app only reads Google Drive.
- **Read-only access:** a Google service account with `drive.readonly` (a JWT signed with node `crypto`, no Google
  library). Nothing of Google's reaches the browser — the server streams each file and passes the browser's `Range`
  to Drive, so seeking works.
- **The library is every reviewed recording.** On Drive each kind of interview (QA and BA × recruiter, technical,
  manager) has a folder with a folder per company inside. The bot uploads into one more folder there («pending for
  review»); the team moves a recording into its company's folder once reviewed. So for each of the bot's six upload
  folders the library takes its parent with everything under it — except the upload folder itself. Audio and video
  only, newest first, cached for 5 minutes. A file outside the library is never served (404).
- **A row:** kind — from the kind folder; company — from the company folder; date, specializations and the
  uploader's name — from the bot's file name `дата - [спеціалізація - ]хто - компанія.ext`. Older names are shown as
  they are, with a date taken from them when there is one (`…_дд.мм.рр`); no date → «Без дати», after the dated ones.
- **Finding one:** company folders first — one per company however its name is spelled across Drive folders, the
  most recorded first (or A–Z); inside, recordings by stage (recruiter → technical → manager), a candidate's
  sub-folder nested. «All recordings» is the plain list. Filters: direction, stage (several), company, search; each
  option shows how many it gives. Filters live in the page address, so a link opens the same selection; unknown
  values are dropped. Most company folders are named in Latin letters, so a Cyrillic search that finds nothing
  suggests trying English.
- **Attachments** — files next to the recordings (a picture of a task, a PDF, notes). Drive ties a file to a folder,
  not to another file, so one goes **beside a recording only when that is certain** (the folder holds one recording,
  or the file's name starts with exactly one recording's name), otherwise on its folder. **Viewed, not downloaded:**
  the server sends a form made to show — a picture re-encoded (no EXIF, so no phone GPS), a PDF as is, a Google
  document exported to PDF, a Word document as a page (no scripts, nothing from elsewhere), text as text; the page
  draws pictures and PDF pages on a canvas. Spreadsheets, presentations, archives are listed, not shown.
  `GET /api/skillklan/interview-recordings/attachments/:id` answers only the page (`x-skillklan-viewer: 1`, without
  it 400), always `inline`, `nosniff`, `CSP: sandbox`.
- **Not configured** → the page says «Записи співбесід ще не підключено.» A person's own interview stages are on each
  job's «Етапи» tab.

## Setting it up (the owner, on the server)

1. Google Cloud: enable the Drive API, create a service account (no roles) and a JSON key.
2. Google Drive: share the folders that hold the bot's six upload folders (the QA and the BA interview folders) with
   the service account's email as **Viewer**.
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

4. Redeploy the digest that is already running: the container reads `app.env` only when it is created, and the deploy
   recreates it when `app.env` changed. Check: «Співбесіди» lists recordings, one plays and seeks, nothing downloads.

Replacing the key later is the same: new key into `app.env`, redeploy the running digest, then delete the old key in
Google Cloud.
