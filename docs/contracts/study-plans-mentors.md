# Study plans: mentors and their students (stage 1)

**Status:** the backend's side is in production (the three lists since 2026-11-04, «My students» since 2026-11-05);
this app's side is built (`src/skillklan/cabinetApi.ts`, `src/skillklan/mentorPlans.ts`, the page
`/dashboard/plan`). **Direction:** SkillKlan Job → SkillKlan backend. **Examples:**
[`examples/study-plans-mentors.json`](./examples/study-plans-mentors.json). Replaces the proposal in pull request #75.

## Need

On «Навчальний план» (`/dashboard/plan`) a student sees their own plan. The admin and the QA moderator also
need to look at other students' plans, the way the school is organised: **mentor → their students → a
student's plan and progress** ([decisions](../decisions.md) D89–D93, D95):

| Who | What they pick | Who they see |
|---|---|---|
| admin | any mentor, or «Без ментора» | that mentor's students, or every student without a mentor |
| QA moderator | a QA mentor, or «Без ментора» | that mentor's students, or QA students without a mentor |

They only look: ticks and notes stay the student's (D92), and giving or taking back a plan stays on
«Плани студентів» (D93). Mentors don't sign in yet (D89) — **the sign-in contract does not change**: no new
role, no new field.

SkillKlan Job keeps no copy of who mentors whom (rule 8 in the [README](./README.md)), so it asks the
backend three things below.

## Who is a mentor, and whose students

The **backend** decides, with its own rule, and this app never repeats it:

- a mentor is a person the school's records mark as a mentor — **not an account role**: a mentor's account
  may have any role, including `admin` or `qa_moderator`;
- "this mentor's students" are the active (not excluded) students the backend counts as theirs — the same
  people the mentor's student list in the SkillKlan Telegram bot shows. How the backend counts (by name
  today, by account link later) may change without changing this contract;
- "without a mentor" — the backend's rule for a student with no mentor at all.

A mentor without a cabinet account is not listed. A student without a cabinet account is not listed: they
have no `cabinetUserId`, so they cannot have a plan here.

## The viewer

Every request carries the **viewer** — the `cabinetUserId` of the person looking — and the backend answers
with what **this viewer** may see: the admin — everything above; the QA moderator — the QA part only; **a viewer
who is a mentor — their own students too** (D98, see «My students» below); a test account (D99) — only itself;
anyone else, an excluded account, an account on a temporary password, an unknown or malformed id — **empty
lists**. What is in the page is the backend's answer, not the session's.

All requests:

| | |
|---|---|
| Headers | `x-jobsync-secret: <JOBSYNC_API_SECRET>` |
| Timeout (this app) | 5 s |
| `401` | `{ "error": "unauthorized" }` — secret missing or wrong |
| `503` | `{ "error": "service_unavailable" }` — the backend has no secret configured |
| `429` | rate limit |

Only `200` with `success: true` and the array named below counts. Ids are integers `> 0`; an entry of any
other shape is skipped. `name` may be empty. All answers carry `Cache-Control: no-store`. An unknown, malformed
(`abc`, `0`, `-5`) or not-allowed id anywhere in the path gives `200` with an **empty list — never 404**, so
ids can't be probed.

## `GET /api/jobsync/users/:viewerId/mentors`

The mentors this viewer may pick, by name.

```json
{
  "success": true,
  "data": {
    "mentors": [
      { "mentorId": 1010, "name": "Олена Коваль", "direction": "QA" },
      { "mentorId": 1011, "name": "Ігор Мельник", "direction": "BA" }
    ]
  },
  "error": null
}
```

`mentorId` — the mentor's `cabinetUserId`. `direction` — the mentor's track code as the cabinet shows it
(`QA`, `BA`, …), may be empty.

## `GET /api/jobsync/users/:viewerId/mentors/:mentorId/students`

The students of one mentor, by name. A mentor this viewer may not pick (a BA mentor for the QA moderator)
gives an empty list.

```json
{
  "success": true,
  "data": {
    "students": [
      { "userId": 1001, "name": "Марія Бондар" },
      { "userId": 1002, "name": "" }
    ]
  },
  "error": null
}
```

`userId` — the student's `cabinetUserId`, the only way to find their plans here. A student with two mentors
is in both lists.

## `GET /api/jobsync/users/:viewerId/students-without-mentor`

Same shape as the previous answer: `{ "students": [ { "userId", "name" } ] }`.

## `GET /api/jobsync/users/:viewerId/mentor` — «My students» (D98)

Is the viewer a mentor themself? For an admin or a QA moderator who mentors, and for the test mentor.

```json
{ "success": true, "data": { "mentor": { "mentorId": 1003, "name": "Аудит Тест Ментор", "direction": "QA" } }, "error": null }
```

`mentor: null` — not a mentor (or not a viewer at all). A mentor's own students: the request above with their
own `mentorId` — open to them always, even outside the QA moderator's QA part. A test account sees nothing else:
its list of mentors and «Без ментора» are empty.

## Budget

- **Is the viewer a mentor** — once per opening of the page.

- **Mentors** — once per opening of the page by the admin or the QA moderator.
- **A mentor's students** or **without a mentor** — once per opening of that entry; one call returns the whole
  list. Plans and progress of those students are read from this app's own data, never once per student.
- **Before showing one student's plan** the app asks the same list again (mentor's or «Без ментора») and
  shows the plan only if the student is in it — a changed address must not open someone else's plan. Calls
  within 30 s share one answer, as for the access check (`src/skillklan/accessRecheck.ts`).
- Nothing is cached longer than that, and nothing is stored: the lists are never copied into this app's
  database.

## Failure

Fail closed. No answer, a timeout, a non-200 or a wrong shape means **an empty list**: the viewer sees a
notice that the list could not be loaded, and no student's plan is shown. The app never falls back to "show
everyone".

## Personal data

| Field | Why |
|---|---|
| `mentorId`, `userId` | `cabinetUserId` — the only identifiers between the backend and this app |
| `name` | students who never signed in to SkillKlan Job have no name here; mentors have no account here at all |
| `direction` | the admin tells mentors apart by track; the QA moderator's list is the QA part |

No phone numbers, no emails, no groups, no payment or contract data.

## Not in this contract

- Mentors signing in (D89): only the test mentor comes in (D99); opening SkillKlan Job to all mentors is a
  separate decision of the owner. The requests above already answer for any mentor who is a viewer.
- Students whose only mentor has been excluded: they have a mentor in the records, so they are not "without
  a mentor", and an excluded mentor is not listed.
- Changing a student's plan or progress (D92, D93).

## What must not change

The paths, the header name, the fields `mentors`, `mentor`, `mentorId`, `direction`, `students`, `userId`,
`name`, and the rule «unknown or not-allowed id → empty list (or `mentor: null`), not 404».
