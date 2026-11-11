# SkillKlan Job

Job-search tracker for SkillKlan students and graduates — jobs, resumes, contacts, interview recordings,
AI help — at `jobs.skillklan.com.ua`. Next.js 15 (App Router), Prisma + SQLite, NextAuth v5, Node 24.
A modified [JobSync](https://github.com/Gsync/jobsync) (MIT), developed on its own since 2026-10-14:
nothing is merged from upstream.

The interface is Ukrainian with an English switch. Commits, pull requests and new code comments — English.

## Who owns what

- **This app** owns a person's job search: jobs, resumes, contacts, tasks, notes — SQLite in `/data`.
- **The SkillKlan backend** (a separate repository you don't have) owns identity and access: who may come
  in, roles, exclusion, prices, balances, AI limits, the admin's action log. This app keeps **no copy** of
  any of it: the role lives only in the session token and is refreshed by the access check.
- The two talk **only through the HTTP contracts in [`docs/contracts/`](docs/contracts/README.md)**. Need
  something new from the backend — propose a contract there; never work around it.

## Commands

| What | Command |
|---|---|
| Install | `npm ci` |
| Dev server | `npm run dev` — <http://localhost:3737> |
| Local backend (cabinet sign-in, roles, access) | `npm run dev:backend` — see [`docs/contracts/local-backend.md`](docs/contracts/local-backend.md) |
| Quick sign-in without the backend | `JOBSYNC_DEV_PASSWORD_LOGIN=1` in `.env.local` (development builds only) |
| All unit tests | `npm test` |
| One test file | `npx vitest run __tests__/path/to/file.spec.ts` |
| Lint | `npm run lint` |
| Types | `npx tsc --noEmit` |
| Production build | `npm run build` |
| Local database | `DATABASE_URL="file:./dev.db" npx prisma migrate deploy` — the Prisma CLI does not read `.env.local` |
| After a schema change | `DATABASE_URL="file:./dev.db" npx prisma migrate dev --name <what>`, then `npx prisma generate` |

CI runs `npm ci`, `npx prisma generate`, `npm run lint`, `npm test` and builds the image. Run the same
before you call a change done — and `npx tsc --noEmit` too: `npm test` does not check types, the build does.

## Workflow

- Branch `sk/<topic>` from the latest `main`, pull request into `main`. Never push to `main` and never
  force-push a shared branch — only the repository owner pushes to `main` (the branch rules enforce it).
- One topic per PR. The description says what changed, why, and how you verified it: the commands and
  what they showed.
- **A merge into `main` is a release**: it goes to production after the checks pass, and a merge by anyone
  but the owner waits for an approval in Telegram. Keep `main` deployable at every commit.
- Only the newest commit of `main` is deployed. A **cancelled** run on `main` was replaced by a newer one — do not
  re-run it; a run for an older commit finishes green without deploying, because its image would roll production back.
- You merge your own pull requests once the checks are green, including those that touch paths in
  `.github/CODEOWNERS` (these instructions, `docs/`, CI and deploy, migrations, `package.json`,
  `package-lock.json`, `LICENSE`): they ask the owner for a review, but it is not required. Still put such
  changes in their own PR.

## Never

- **Production is not a test bench.** Don't call `jobs.skillklan.com.ua`, `api.skillklan.com.ua` or
  `app.skillklan.com.ua` from code, tests or scripts. Develop against `npm run dev:backend` and local SQLite.
- **No secrets, real student data or local machine paths** in the repo, logs, screenshots or PRs. `.env*`
  files stay local; a new variable goes into `.env.example` with an empty value. A test guards the docs.
- **No new npm package without the owner's approval** — ask before `npm install <package>`. New
  dependencies are the main source of vulnerabilities here.
- **No access, roles or money in SQLite** — no role column, balance, price or limit. They are the backend's.
- **Don't weaken a gate "for now"**: fail-closed checks, timeouts, feature switches, limits. If one is in
  your way, say so in the PR instead.
- **Keep `LICENSE` and the JobSync attribution** (MIT condition). MCP was removed on purpose — don't bring
  it back. No `latest` image tag, no `curl | bash`.

## Tests

A test proves the code does the **right** thing — not that it does what it does today.

1. Derive the expected value from the requirement — [`docs/decisions.md`](docs/decisions.md), a contract,
   a hand calculation — before reading the implementation. An expectation copied from the current output
   is a snapshot of the bug, not a test.
2. **Red before green**: the new test must fail on the broken version, and for the reason it is about —
   not a `TypeError` from a half-written mock. Break the code on a copy; never `git checkout` over your work.
3. Before you change anything, run the suite and write down which tests already fail. Otherwise "4 failed"
   after your change tells nothing.
4. Access and money need negative tests: excluded person, wrong role, reused or expired code, a switched-off
   feature, zero balance — none of them gets through.
5. Before "done", name the test that would fail if the bug came back. No such test — no tests for it yet.

## Where the code misleads

- `src/skillklan/` is ours (integrations, admin API, feature switches, recordings). Everything else came from
  upstream; change it in place when needed, no wrappers "for later".
- **"Admin" in upstream names is not the SkillKlan admin.** `src/app/dashboard/admin` and
  `src/components/admin` are one person's own lists (the «Довідники» page). The SkillKlan admin is a backend
  role: `managesSkillklanJob()` in `src/skillklan/cabinetApi.ts`; an admin-only action re-asks the backend
  at that moment (`confirmCabinetAdmin`).
- **`auth()` runs the `jwt` callback on every call** — one page load calls it many times. The backend access
  check is shared per person for 30 s (`src/skillklan/accessRecheck.ts`). Never add a backend call to a
  render path or a session callback.
- `/signup` and password sign-in are upstream code switched off in production builds; the only way in is
  the cabinet's one-time code (`src/app/auth/cabinet/route.ts`). Don't switch them back on.
- **Feature switches** (`src/skillklan/features.ts`): Automations, Activities and the Library are **off**.
  Off means hidden from menus **and** refused by every server action that changes that area — a new action
  there must check its switch too.
- `.claude/` in a clone may hold other checkouts (agent worktrees): vitest, eslint and tsc exclude it.

## More

- [`docs/decisions.md`](docs/decisions.md) — the owner's decisions that shape the code. Follow them literally;
  changing one is the owner's call.
- [`docs/glossary.md`](docs/glossary.md) — how the interface is translated.
- [`docs/contracts/`](docs/contracts/README.md) — every contract with the backend, and how to ask for a new one.
- `.claude/rules/` — rules that load when you work in their folders: integration, database, AI, automations,
  translations, tests.

<!-- sk-sdlc:begin v1 — generated from the SkillKlan knowledge base (_meta/sdlc/repo-layer); edit it there -->
## SkillKlan development process: Jira issue + knowledge base (required)

Every code change made with Claude Code leaves two traces: **an issue in the development
Jira** (project `SKD`) with a comment and a status, and **an entry in the SkillKlan
knowledge base**. This step is not skipped. The hooks in `.claude/` enforce it: a commit
without an `SKD-n` key is refused, and a session that edited code without a Jira write
does not end.

**Before the first code edit:**
1. Check the Atlassian connector: `getAccessibleAtlassianResources` must list the
   development Jira site (cloudId `4892f50a-33f4-4893-8943-9ac212cb7b5c`) and a search
   must see project `SKD`. **No Atlassian tools or no such site — stop and help the person
   set it up:**
   - Claude Code: `claude mcp add --transport http --scope user atlassian https://mcp.atlassian.com/v2/mcp`,
     then `/mcp` → atlassian → Authenticate, signing in **with the account invited to the
     development Jira**;
   - Claude app: Settings → Connectors → Atlassian → Connect;
   - the site is not listed — the invitation is not accepted yet (an Atlassian email) or it
     is another account: ask the owner. No API keys are needed, never paste them into chat.
2. Find the issue: a key from the person, or
   `project = SKD AND labels = proj-jobsync AND statusCategory != Done`.
   None — **create it yourself**: a Task under the epic «jobsync — поточні роботи» (no
   epic — create an Epic labelled `proj-jobsync`, `поточні-роботи`); issue labels
   `proj-jobsync`, `claude-session`. Move it to `in development`.

**While working:** commits carry the key — `SKD-12: what changed` (this repository's
branch and pull request rules still apply). A bug found on the way — a Bug; deferred tech
debt — a Task labelled `техборг`, under the same epic.

**At the end:**
- a comment on the issue: **Done / Commits / How verified / Knowledge base notes / Open**;
- status: **Done only when the change is in `main` and verified**; otherwise
  `in development` or `review` with what is left (transitions are named `in development`,
  `review`, `Done`);
- a knowledge base entry (the project journal, line `**Jira:** SKD-n — status`). No
  knowledge base on this machine yet — add a «For the knowledge base:» part to the Jira
  comment and ask the owner for access. The full contour (knowledge base + Jira) is
  installed from the knowledge base, see `_meta/sdlc/ПРОЦЕС.md` there.

Write to Jira with the direct tools (`createJiraIssue`, `transitionJiraIssue`,
`addOrEditJiraIssueComment`), not the generic `executeWrite` — the hook would not see it.
<!-- sk-sdlc:end -->
