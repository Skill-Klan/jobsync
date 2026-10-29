# Cabinet sign-in and access check

**Status:** in production since 2026-10-14. **Direction:** SkillKlan Job → SkillKlan backend.
**Client:** `src/skillklan/cabinetApi.ts`. **Examples:** [`examples/backend-login.json`](./examples/backend-login.json).

## How sign-in works

1. A person presses «SkillKlan Job» in the SkillKlan cabinet (`app.skillklan.com.ua`). The cabinet asks the
   backend for a **one-time code** (`POST /api/jobsync/login-code`, the person's cabinet session; not called by
   this app).
2. The cabinet page posts a form with the `code` field to `https://jobs.skillklan.com.ua/auth/cabinet` in the
   same tab. The code travels in the body, never in the URL. This app accepts the form only from the origin
   of `CABINET_URL`.
3. This app's server **exchanges** the code at the backend and opens its own session (8 hours from the last
   request).
4. While the session lives, the app **re-checks access** at least every 5 minutes. A "no", an error or a
   timeout ends the session. An excluded student is out within 5 minutes — that is a requirement.

**Who may come in** is decided by the backend only: role `student`, `admin` or `qa_moderator`, an active
account, not on a temporary password. This app never repeats that rule; it only trusts the answer.

Configuration: `SKILLKLAN_API_URL` (base URL), `JOBSYNC_API_SECRET` (the shared secret), `CABINET_URL` (where
the form comes from). Any of them missing → nobody signs in.

## `POST /api/jobsync/login-code/exchange`

Trade a one-time code for the person behind it. **Not idempotent**: the code burns on first use — never retry.

| | |
|---|---|
| Headers | `x-jobsync-secret: <JOBSYNC_API_SECRET>`, `content-type: application/json` |
| Body | `{ "code": "<43 characters, base64url>" }` — 32 random bytes, lives 60 s, one live code per person |
| Timeout (this app) | 5 s for connect, answer and body together |
| Budget | once per sign-in |

| Status | Body | Meaning |
|---|---|---|
| `200` | `{ "success": true, "data": { "userId": 1001, "role": "student", "name": "…" }, "error": null }` | signed in; `userId` is the backend's account id (`cabinetUserId` here) |
| `401` | `{ "error": "…", "message": "…", "code": "JOBSYNC_CODE_INVALID" }` | unknown, used, expired, malformed or missing code — **one answer for all**, no hint which |
| `403` | `{ "error": "…", "message": "…", "code": "JOBSYNC_ACCESS_DENIED" }` | the code was valid, but the person lost access in the meantime (the code is spent) |
| `401` | `{ "error": "unauthorized" }` | the secret header is missing or wrong (the code is **not** spent) |
| `503` | `{ "error": "service_unavailable" }` | the backend has no secret configured |
| `429` | — | rate limit |

Only `200` with `success: true`, an integer `userId > 0` and a role from the list above counts as a sign-in;
everything else is a refusal. `name` may be empty.

## `GET /api/jobsync/users/:id/access`

Is this person still allowed in, and with which role.

| | |
|---|---|
| Headers | `x-jobsync-secret: <JOBSYNC_API_SECRET>` |
| Path | `:id` — `cabinetUserId` |
| Timeout (this app) | 5 s |
| Budget | at most once per 5 minutes per signed-in person; calls within 30 s share one answer (`src/skillklan/accessRecheck.ts`); an admin-only action asks again at that moment |

| Status | Body | Meaning |
|---|---|---|
| `200` | `{ "success": true, "data": { "allowed": true, "role": "admin" }, "error": null }` | allowed, with the current role |
| `200` | `{ "success": true, "data": { "allowed": false, "role": null }, "error": null }` | not allowed — also for an unknown, malformed (`abc`, `0`, `-5`) or another role's id; **never 404**, so ids can't be probed |
| `401` | `{ "error": "unauthorized" }` | secret missing or wrong |
| `503` | `{ "error": "service_unavailable" }` | the backend has no secret configured |

All answers of both endpoints carry `Cache-Control: no-store`.

## What must not change

The paths, the header name, the fields `userId`, `role`, `name`, `allowed`, the codes `JOBSYNC_CODE_INVALID` and
`JOBSYNC_ACCESS_DENIED`, and the rule "unknown id → `allowed: false`, not 404". New roles are added on both sides
at once; until then this app treats an unknown role as no role.
