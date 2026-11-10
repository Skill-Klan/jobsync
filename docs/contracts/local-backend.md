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
| 1004 | Test Mentor | `mentor` | yes — a test account (D99); mentors the QA students 1001, 1006; has no admin rights |
| 1005 | Excluded Student | `student`, excluded | no — gets no code |
| 1006–1009 | Maria Bondar, Ihor Melnyk, two students without a mentor | `student` | no — students don't come in before D48 (they only appear in the mentor lists) |

«Exclude» / «Restore» changes a person on the fly. A signed-in person who is excluded loses the session at
the next access check — at most 5 minutes later.

The stand-in follows the real backend's rule since the study-plans PR (D99–D102): it lets in the admin, the QA
moderator and the test accounts (`testAccounts`, by default 1001 and 1004), and refuses other students until
D48 ([sign-in contract](./backend-login.md)). It also answers the mentor lists and «My students»
([study plans](./study-plans-mentors.md)): the admin sees every mentor, the QA moderator the QA ones, a mentor
their own students. Mentors and their students are `DEFAULT_MENTORS` in the stand-in; the answers match
[`examples/study-plans-mentors.json`](./examples/study-plans-mentors.json).

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
