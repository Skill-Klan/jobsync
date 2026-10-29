# Contracts with the SkillKlan backend

SkillKlan Job and the SkillKlan backend share **no database and no code** — only the HTTP contracts below.
The backend lives in another repository; this folder is everything this app may rely on.

| Contract | Direction | Status |
|---|---|---|
| [Cabinet sign-in and access check](./backend-login.md) | this app → backend | in production |
| [Admin statistics (machine API)](./admin-stats.md) | backend → this app | this app's side deployed; backend side pending |
| [Local backend for development](./local-backend.md) | — | `npm run dev:backend` |

The example requests and answers in [`examples/`](./examples) are checked by tests against the local
backend (`__tests__/skillklan/backendStubContract.spec.ts`), and the local backend answers like the real one
— so the examples, the stand-in and the client in `src/skillklan/cabinetApi.ts` cannot drift apart unnoticed.

## Rules every contract follows

1. **One need, one narrow endpoint.** A new need gets its own endpoint in the `/api/jobsync/...` family on
   the backend — never a cabinet endpoint reused, never "one endpoint for everything". Widening later is cheap,
   narrowing is not.
2. **Server to server, secret in a header.** Calls to the backend carry `x-jobsync-secret`; calls from it carry
   `x-jobsync-admin-secret` (a different secret: leaking one direction must not open the other). The
   browser of this app never calls the backend.
3. **Envelope** `{ "success": true, "data": …, "error": null }` on success. Refusals carry a status and, where
   it matters, a machine `code`. **Branch on the status and the code, never on the text** — texts are
   Ukrainian and may change.
4. **Minimum personal data.** People are identified by `cabinetUserId` (the backend's account id) only. No
   phone numbers, no emails, in either direction.
5. **Fail closed, explicit timeouts.** No answer, a timeout, a non-200 or an unexpected shape means "no
   access" / "no AI" / "no data" — never a default that lets someone in.
6. **A call budget is part of the contract**: how often the app may call, per person and in total. Calls in a
   render path or once per row of a list are not allowed — ask for a batch endpoint.
7. **Additive changes only.** A new optional field is fine; renaming, removing or changing the meaning of a
   field is a new endpoint.
8. Access, roles, money, prices, limits and the admin's action log **belong to the backend**. This app never
   stores a copy.

## Asking for a new endpoint

Open a pull request that adds a page here (it needs the owner's review), with:

- **Need** — the feature and why the existing contracts don't cover it.
- **Request** — method, path under `/api/jobsync/`, headers, body or query, with an example.
- **Answers** — the success shape with an example, and every refusal with its status and `code`.
- **Budget** — when the app calls it and how often (per person, per page, per day); what is cached and for how long.
- **Failure** — what the app does when the backend says no, times out, or is down.
- **Personal data** — which fields leave the backend and why each is needed.

The owner builds and deploys the backend side first (additive, nothing breaks); then the app's side is merged.
Add the endpoint to the local backend and to `examples/` in the same PR as the app's side.
