# Mentor and their students

**Status:** proposed — neither side is built. **Direction:** SkillKlan Job → SkillKlan backend.
**Client (planned):** `src/skillklan/cabinetApi.ts`.

## Need

Study plans (Settings → «Функції» → `plans`) are given to a student by the admin. The student's mentor must
then see the plans and progress of **their own students** — and nobody else's.

The backend already knows which mentor teaches which student. SkillKlan Job keeps no copy of it
(rule 8 in the [README](./README.md)), so it needs two things the existing
[sign-in contract](./backend-login.md) does not give:

1. a mentor can sign in — a new role `mentor`;
2. the app can ask «which students are this mentor's».

Nothing else changes: a mentor does not manage SkillKlan Job (no Settings → «Функції»), and giving a plan to a
student stays with the admin.

## The new role

`mentor` joins `student`, `admin` and `qa_moderator` in the `role` field of both existing answers
(`login-code/exchange` and `users/:id/access`). Same rules as for the others: the backend decides who may come
in, the app only trusts the answer. As the sign-in contract says, new roles are added **on both sides at
once** — until the app's side is deployed it treats `mentor` as no role, so the backend may ship first
without breaking anything.

## `GET /api/jobsync/mentors/:id/students`

The students of one mentor.

| | |
|---|---|
| Headers | `x-jobsync-secret: <JOBSYNC_API_SECRET>` |
| Path | `:id` — the mentor's `cabinetUserId` |
| Timeout (this app) | 5 s |

```json
{
  "success": true,
  "data": {
    "students": [
      { "userId": 1001, "name": "Олена К." },
      { "userId": 1002, "name": "" }
    ]
  },
  "error": null
}
```

| Status | Body | Meaning |
|---|---|---|
| `200` | `{ "success": true, "data": { "students": [ … ] }, "error": null }` | the mentor's current students; may be empty |
| `200` | `{ "success": true, "data": { "students": [] }, "error": null }` | also for an unknown id, an id that is not a mentor's, or a malformed one (`abc`, `0`, `-5`) — **never 404**, so ids can't be probed |
| `401` | `{ "error": "unauthorized" }` | secret missing or wrong |
| `503` | `{ "error": "service_unavailable" }` | the backend has no secret configured |
| `429` | — | rate limit |

Only `200` with `success: true` and a `students` array counts. A student counts only with an integer
`userId > 0`; an entry of any other shape is skipped. `name` may be empty. All answers carry
`Cache-Control: no-store`.

A student who has been removed from the mentor must disappear from the answer at once: the app asks again at
the moment of every action on a student (see Budget), so there is no delay to wait out.

## Budget

- **Once per opening of the mentor's «Мої студенти» page** — one call returns the whole list; the plans and
  progress of those students are read from the app's own data. Never once per student.
- **Once per action on a single student** (looking at their plan, later marking something): the app checks
  that the student is in a fresh list. Calls within 30 s share one answer, as for the access check
  (`src/skillklan/accessRecheck.ts`).
- Nothing is cached for longer than that, and nothing is stored: the list is never copied into the app's
  database.

## Failure

Fail closed. No answer, a timeout, a non-200 or a wrong shape means **«no students»**: the mentor sees an
empty page with a notice that the list could not be loaded, and no action on any student is allowed. The app
never falls back to «show everyone».

## Personal data

| Field | Why |
|---|---|
| `userId` | the student's `cabinetUserId` — the only way to find their plans here |
| `name` | the mentor's page lists students that have never signed in to SkillKlan Job, who have no name here |

No phone numbers, no emails, no groups, no payment or contract data.

## What must not change

The path, the header name, the fields `students`, `userId`, `name`, and the rule «unknown id → empty list, not
404».
