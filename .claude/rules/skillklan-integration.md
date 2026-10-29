---
paths:
  - "src/skillklan/**"
  - "src/auth.ts"
  - "src/auth.config.ts"
  - "src/middleware.ts"
  - "src/app/auth/**"
  - "src/app/skillklan/**"
  - "src/app/api/skillklan/**"
---

# Backend integration, sign-in, admin API

- Every call to the backend follows a contract in `docs/contracts/`. A new need = a new narrow endpoint
  proposed there first (`docs/contracts/README.md`); don't reuse cabinet endpoints, don't add fields "while
  we're at it". The owner builds the backend side.
- **Fail closed** on every call: missing config, timeout, non-200, `success !== true` or an unexpected shape
  all mean "no". Explicit timeout (`CABINET_API_TIMEOUT_MS`, 5 s); retry only idempotent reads; never retry
  the code exchange (the code burns on first use).
- Validate the backend's answer as strictly as `exchangeLoginCode` does: integer ids > 0, a role from
  `CABINET_ROLES`, anything unknown → no role. A role we don't know never "manages".
- **Call budget**: access is re-checked at most every 5 minutes per person (revocation must take effect
  within 5 minutes — owner's rule), and calls within 30 s share one answer. A new backend call must state its
  budget in the contract; per-render or per-row calls are not allowed — ask for a batch endpoint instead.
- Identify people by `cabinetUserId` only. No phone numbers or emails from the backend, none sent to it.
- Secrets travel in headers (`x-jobsync-secret` to the backend, `x-jobsync-admin-secret` from it), compared
  in constant time; never in URLs, logs or error messages. The one-time code is never logged.
- `/auth/cabinet` accepts a form POST only from the origin of `CABINET_URL` (login CSRF: `app.` and `jobs.`
  are one site for the browser). Keep that check.
- The machine API for the backend lives **outside `/api`** (`/skillklan/admin/...`) so the session middleware
  never sees it; the secret is the only way in, `Cache-Control: no-store`, numbers only — no names, titles,
  notes or resume text.
- Admin features (JA4–JA8) are view-only (owner D41, D45): the admin views, exports, switches access; nothing
  edits a student's data. Each view is logged by the backend, which calls this app — not the other way round.
- Deleting an excluded student's data: 30 days after exclusion, triggered by the backend through the machine
  API (owner D14). Before day 31 the data is there; after, it is gone — both are test requirements.
