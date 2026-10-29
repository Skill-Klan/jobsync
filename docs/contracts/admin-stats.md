# Admin statistics (machine API)

**Status:** this app's side is deployed (since 2026-10-16) and answers `503` until the secret is set; the
backend's side and the cabinet's pages are not in production yet. **Direction:** SkillKlan
backend → SkillKlan Job. **Server:** `src/skillklan/adminApi.ts`, `src/skillklan/adminStats.ts`,
`src/app/skillklan/admin/stats/`.

The SkillKlan cabinet shows the admin how students use SkillKlan Job. The cabinet asks the backend; the
backend asks this app for **numbers only** and adds names, access and history on its side. The admin's
view of a person is logged by the backend.

## Requests

| Request | `data` |
|---|---|
| `GET /skillklan/admin/stats` | `{ "users": UserStats[], "unlinkedAccounts": number, "generatedAt": "<ISO time>" }` — everyone who came in from the cabinet |
| `GET /skillklan/admin/stats/:cabinetUserId` | `{ "user": UserStats \| null, "generatedAt": "<ISO time>" }` — never came in → `null`, not 404 |

```ts
type UserStats = {
  cabinetUserId: number;
  firstLoginAt: string;          // account created = first sign-in
  lastLoginAt: string | null;    // last sign-in from the cabinet — not "last seen": sessions slide
  jobs: { total: number; applied: number; byStatus: Record<string, number> };
  interviews: number;
  resumes: number;
  coverLetters: number;
  automations: { total: number; active: number };
  tasks: number;
  activities: number;
  contacts: number;
  questions: number;
};
```

**Numbers only** — no job titles, companies, notes or resume text.

## Protection

- The routes live **outside `/api`**, so the session middleware never sees them; the caller is a server.
- Header `x-jobsync-admin-secret` = `JOBSYNC_ADMIN_API_SECRET` — a different secret from the one this app
  sends the backend. Unset or shorter than 32 characters → `503`; missing or wrong → `401`; compared in
  constant time.
- Envelope `{ "success": true, "data": …, "error": null }`; refusals `{ "success": false, "data": null,
  "error": "unauthorized" | "service_unavailable" | "bad_request" | "internal" }`. A malformed
  `:cabinetUserId` is `400 bad_request`.
- `Cache-Control: no-store` on every answer.

## The backend's side (for context)

Timeout 10 s, no retries; it accepts only `200` with exactly this shape, otherwise the whole answer is
invalid. It takes a daily snapshot at 23:50 Kyiv time, so a slow or changed answer breaks the admin's
history, not only a page.

## What must not change

The paths, the header, the `UserStats` fields and their meaning. Add fields, never rename or remove them.
Planned admin features (viewing a student's content, export, deleting an excluded student's data after
30 days) will be **new** endpoints here, each proposed as in [README](./README.md).
