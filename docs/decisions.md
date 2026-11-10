# Owner's decisions that shape the code

The owner of SkillKlan decided these; the numbers are the owner's (`D…`). Follow them **literally** — don't
reinterpret, and don't "improve" one in passing. Changing a decision is the owner's call: ask in the PR.
Only decisions that matter for code are listed.

## Product and access

| # | Decision |
|---|---|
| D4, D22 | Users are SkillKlan **students and graduates**: every account with role `student` that is not excluded, whatever the stage of study. |
| D5a | Served at its own origin, `jobs.skillklan.com.ua` — never under a path of the cabinet. |
| D5b | **One sign-in** with the cabinet: the cabinet's one-time code; own sign-up and passwords are off in production. |
| D23, D81 | The admin and the **QA moderator** come in too, and both manage SkillKlan Job (Settings → «Функції»). Mentors and other roles don't — except the test accounts (D99). |
| D48 | Students get the cabinet button **last**, after everything else is done. Until then only the admin, the QA moderator and the test accounts see it. |
| D99 | Two **test accounts** — a test mentor and a test student — come in whatever their role; the backend keeps their ids in its configuration. |
| D100 | **The backend decides who sees the cabinet button**, by the same rule as sign-in. |
| D101 | Until D48 the backend **refuses students too**, not only the cabinet hiding the button (D22 applies after D48). |
| D71, D72 | The cabinet opens SkillKlan Job **in the same tab**; the menu item «Кабінет» goes back to `CABINET_URL`. |
| Rule | Revoked access takes effect **within 5 minutes**. |
| D14 | An excluded student loses access at once (≤ 5 min); their data is **deleted 30 days later**; until then they may ask for an export. |

## Admin

| # | Decision |
|---|---|
| D12a | The admin may see everything of one person, resumes included; **every view is logged** in the backend. |
| D41, D45 | The admin views (in the cabinet, a «SkillKlan Job» tab of the student card; resumes as PDF), exports, switches access — **never edits** a student's data. |
| D44 | Students are not notified that the admin can view their data. |
| D42, D43 | Statistics count everyone with access, including those who never came in (zeros); the admin's own account separately. A daily snapshot gives history from the launch day. |
| D49 | **One identifier** of a student in the admin pages — the cabinet's student card id; the account id stays between the backend and this app. |

## AI (J4 — not connected yet)

| # | Decision |
|---|---|
| D6 | Cloud models only; no local models (no Ollama). |
| D6a, D8 | The owner's key with the school's **markup**; students **top up a balance** in advance; at zero, AI stops. The markup size is open. |
| D31 | The language of AI answers — decided later; prompts stay as they are. |

## Interface

| # | Decision |
|---|---|
| D18 | The app is called **«SkillKlan Job»**. |
| D29, D30 | Ukrainian interface with an English switch; one term — one translation (`docs/glossary.md`). |
| D33, D38 | Fonts with Cyrillic in the interface and in PDFs (Inter, Tinos, Cousine — bundled, OFL). |
| D34, D35 | «AI», not «ШІ»; «навички», not «теги». |
| D36, D37 | 24-hour time in Ukrainian; PDF headings and dates stay in English, the student's text as it is. |
| D53–D56, D73–D76 | **Feature switches** («Функції»): Activities, Automations (with notifications) and the Library are off; only the admin / QA moderator switches them; switched off is hidden from everyone, the admin included; with the Library off, company names are plain text. |

## Interview recordings («Співбесіди»)

| # | Decision |
|---|---|
| D57, D59, D60 | A library of **all reviewed** recordings, for everyone this app lets in; not tied to people. |
| D58, D63 | **Listening only** — no download anywhere; uploads stay with the Telegram bot. |
| D62, D64 | «Співбесіди» is only this library (no «my interviews» tab). |
| D65–D70 | Everything under the shared QA and BA folders except «pending review»; grouped by company, then stage; filters: direction, stage, company, search — kept in the page address. |
| D61 | The uploader's name from the file name is shown. |
| D77–D80 | Attachments next to a recording only when the match is certain, otherwise on its folder; pictures, PDFs and other files are **viewed, not downloaded**; for everyone, like the recordings. |

## Study plans («Навчальний план»)

| # | Decision |
|---|---|
| D89 | Mentors **don't sign in yet**. The first stage is for the admin and the QA moderator: mentor → their students → a student's plan. |
| D90, D95 | The admin sees every mentor and every student without a mentor; the QA moderator — **QA mentors and QA students without a mentor only**. |
| D91 | Students without a mentor are a separate entry, «Без ментора». |
| D92 | The admin and the QA moderator **only look** at a student's plan; ticks and notes stay the student's. |
| D93 | Giving and taking back a plan stays on «Плани студентів»; the mentor path is view-only. |
| D98 | An admin or a QA moderator who is a mentor sees **their own students** and their plans («My students»); the test mentor too. Other mentors still don't sign in (D89). |
| D102 | The colleague builds this app's side of «My students» and the test mentor's sign-in; the agent — the backend, the cabinet and the contracts. |

## Engineering

| # | Decision |
|---|---|
| D7a | **MCP is removed** from the code; bringing it back is the owner's decision. |
| D16 | Own code base: nothing is taken from upstream JobSync; `LICENSE` and attribution stay (MIT). |
| D19 | Node 24 in the image and CI. |
| D21 | The repository and the image are public during development and become private at the end. |
| D82 | **A push into `main` is a release**: tests and the image in parallel → production. The owner's pushes deploy without a button; anyone else's wait for the owner's approval in Telegram. |
| D84 | Contributors don't push to `main`: pull requests only. Ordinary PRs the contributor merges after green checks; ~~PRs touching CODEOWNERS paths need the owner's review~~ — replaced by D103. |
| D85 | Agent instructions, commits and PRs are in **English**. |
| D87 | **New npm packages only with the owner's approval.** |
| D88 | **Only the head of `main` is deployed.** A run whose commit is no longer the head of `main` deploys nothing (checked before the Telegram button and after it). A manual deploy of a digest — a deliberate redeploy or rollback — is not checked. |
| D103 | **The contributor merges every pull request after green checks**, CODEOWNERS paths included (2026-11-10). Those PRs still ask the owner for a review, but it is not required; pushing to `main` and force-pushing stay closed. |
