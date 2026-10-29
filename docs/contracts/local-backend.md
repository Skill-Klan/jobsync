# Local backend for development

`npm run dev:backend` starts a stand-in for the SkillKlan backend
([`skillklan/dev/backend-stub.mjs`](../../skillklan/dev/backend-stub.mjs)) at <http://127.0.0.1:3739>. It has
fake people only, keeps everything in memory and makes no network calls. Use it for anything about sign-in,
roles, access or admin features — never the real backend.

## Set up

In `.env.local` (any development secret will do — the stand-in reads the same file):

```sh
SKILLKLAN_API_URL=http://127.0.0.1:3739
CABINET_URL=http://127.0.0.1:3739
JOBSYNC_API_SECRET=<any local value, at least 32 characters>
```

Then, in two terminals: `npm run dev:backend` and `npm run dev`. Open <http://127.0.0.1:3739> — the local
cabinet — and press «Open SkillKlan Job» next to a person. The page gets a one-time code and posts it to
SkillKlan Job's `/auth/cabinet`, the way the real cabinet does.

| id | Person | Role | May come in |
|---|---|---|---|
| 1001 | Test Student | `student` | yes |
| 1002 | Test Admin | `admin` | yes — manages SkillKlan Job (Settings → «Функції») |
| 1003 | Test QA Moderator | `qa_moderator` | yes — manages SkillKlan Job too |
| 1004 | Test Mentor | `mentor` | no — gets no code |
| 1005 | Excluded Student | `student`, excluded | no — gets no code |

«Exclude» / «Restore» changes a person on the fly. A signed-in person who is excluded loses the session at
the next access check — at most 5 minutes later.

Without `JOBSYNC_API_SECRET` the stand-in answers `503`, like the backend without its secret; a different
secret on the two sides gives `401` — both end in «sign-in failed», never in a sign-in.

## In tests

```ts
// @vitest-environment node
import { createBackendStub } from "../../skillklan/dev/backend-stub.mjs";

const stub = createBackendStub({ secret: "a-local-secret-of-at-least-32-chars" });
await new Promise<void>((resolve) => stub.server.listen(0, "127.0.0.1", resolve));
const code = stub.issueCode(1001); // what the cabinet would post
stub.setActive(1001, false);       // exclude someone mid-session
```

`now` can be passed to move time (code expiry). The answers match
[`examples/backend-login.json`](./examples/backend-login.json) — `__tests__/skillklan/backendStubContract.spec.ts`
holds them to it.

## What it does not do

Rate limits (`429`), the cabinet's own session and `POST /api/jobsync/login-code` (its page issues codes
directly), and the backend's side of the admin statistics. When a new backend endpoint is agreed
([README](./README.md)), add it here and to `examples/` in the same PR as the app's side.
