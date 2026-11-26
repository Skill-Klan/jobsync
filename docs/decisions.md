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
| D23, D81 | The admin and the **QA moderator** come in too, and both manage SkillKlan Job (Settings → «Функції»). Since 2026-11-25 students and mentors come in as well (D48, D89), without those rights; other roles don't — except the test accounts (D99). |
| D48 | Students get the cabinet button **last**, after everything else is done. **Done 2026-11-25** — the owner: «Відкривай доступ для студентів і менторів». |
| D99 | Two **test accounts** — a test mentor and a test student — come in whatever their role; the backend keeps their ids in its configuration. |
| D100 | **The backend decides who sees the cabinet button**, by the same rule as sign-in. |
| D101 | Until D48 the backend **refused students too**, not only the cabinet hiding the button — until 2026-11-25, when D48 was done. |
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
| D104 | **Transcripts through ElevenLabs** (Scribe), not a local model; with limits — one job per person waiting, the queue pauses when the credits run out — and a Telegram alert when what is left covers about two interviews (the alert is not built yet). |
| D105 | The approved look: «Транскрибувати» beside a recording → a spinner → the panel below it opens by itself with the text and **«Копіювати»**; afterwards the button is «Текст». Anyone signed in may press it; the transcript is kept and shared — made once per recording. Copying the text is the owner's explicit wish, unlike the recordings (D63). |
| D106 | The text shows **who speaks and when** — «Спікер 1 / Спікер 2» with the time — not one block. |
| D107 | The ElevenLabs key comes from **the same account** that voices the videos: one pool of credits for both. |
| D108 | Alerts about the credits go to **the managers' group**, «Алерти» topic, through the SkillKlan bot (a narrow endpoint with its own secret) — not to the owner personally, not with a bot token in this app. |
| D109 | Billing above the plan is **switched off** in ElevenLabs; if this app sees it on (or already billed), it alerts and stops new transcripts. |
| D110 | Recordings may be sent to ElevenLabs (zero retention is Enterprise-only). |
| D111 | The four alert texts — low (with the time left), out (new transcripts stopped), topped up, overage on — word for word, kept in the bot. |
| D112 | The balance can't be read (the key may not read the account, ElevenLabs is down) → **the log only**, no alert; transcripts go on. |
| D114 | **Asked before transcribing** (2026-11-21): a recruiter interview — «Це рекрутерська співбесіда. Точно хочете її транскрибувати?»; a technical one — one question to confirm (a manager one the same — the agent's assumption); a recording already transcribed asks nothing and shows its text. |

## Onboarding video

| # | Decision |
|---|---|
| D115 | The onboarding is a **recorded video** (2026-11-24), one for a student and one for a mentor, voiced, the parts being talked about highlighted in the picture — not a tour over the live interface. |
| D118 | **The first sign-in: the person's video must be watched to the end** — no way to close or skip it before; then **«Все зрозуміло» in the middle of the screen** closes it. **Never again by itself** after that (2026-11-24). Which video: the mentor's for a mentor (the backend's answer, as for the study plans), the student's for anyone else; the admin and the QA moderator are not made to watch (the agent's assumption, not objected to). Watched again any time from the menu, «Відео-огляд». |

## Study plans («Навчальний план»)

| # | Decision |
|---|---|
| D89 | ~~Mentors don't sign in yet~~ — **mentors sign in since 2026-11-25** (with students, D48) and see only themselves: their own students and their plans, no other mentor, no mentor list, no «Без ментора». The first stage was for the admin and the QA moderator: mentor → their students → a student's plan. |
| D90, D95 | The admin sees every mentor and every student without a mentor; the QA moderator — **QA mentors and QA students without a mentor only**. |
| D91 | Students without a mentor are a separate entry, «Без ментора». |
| D92 | The admin, the QA moderator and a mentor **work in** a student's plan like the student: they tick points and write notes in the same fields, no author is kept (changed 2026-11-18 from view-only; usually only the mentor does it, for the student it is optional). |
| D93 | Giving and taking back a plan stays on «Плани студентів»; the mentor path only ticks and annotates, it never gives or takes back. |
| D98 | An admin or a QA moderator who is a mentor sees **their own students** and their plans («My students»); since 2026-11-25 every mentor does (D89). |
| D102 | The colleague builds this app's side of «My students» and the test mentor's sign-in; the agent — the backend, the cabinet and the contracts. |

## Engineering

| # | Decision |
|---|---|
| D7a | **MCP is removed** from the code; bringing it back is the owner's decision. |
| D16 | Own code base: nothing is taken from upstream JobSync; `LICENSE` and attribution stay (MIT). |
| D19 | Node 24 in the image and CI. |
| D21 | The repository and the image are public during development and become private at the end. |
| D11 | **A copy of `/data` lives off Server2, on the owner's Mac** (2026-11-25: «На Mac, як прод» — like the backups of the main production server; not Contabo's storage). The Mac pulls it every day with a key of its own that can take the copy and nothing else; the deploy keys cannot take it. Taken without stopping the app, proved whole on arrival — [backups.md](./backups.md). |
| D82 | **A push into `main` is a release**: tests and the image in parallel → production. The owner's pushes deploy without a button; anyone else's wait for the owner's approval in Telegram. |
| D84 | Contributors don't push to `main`: pull requests only. Ordinary PRs the contributor merges after green checks; ~~PRs touching CODEOWNERS paths need the owner's review~~ — replaced by D103. |
| D85 | Agent instructions, commits and PRs are in **English**. |
| D87 | **New npm packages only with the owner's approval.** |
| D88 | **Only the head of `main` is deployed.** A run whose commit is no longer the head of `main` deploys nothing (checked before the Telegram button and after it). A manual deploy of a digest — a deliberate redeploy or rollback — is not checked. |
| D103 | **The contributor merges every pull request after green checks**, CODEOWNERS paths included (2026-11-10). Those PRs still ask the owner for a review, but it is not required; pushing to `main` and force-pushing stay closed. |
