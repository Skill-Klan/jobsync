# Contributing to SkillKlan Job

This repository is SkillKlan's own code base (a modified JobSync, MIT). It does not take changes from or
send changes to upstream JobSync. Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

Working with an AI agent? It reads [CLAUDE.md](./CLAUDE.md) and `.claude/rules/` — the same rules as
below, in more detail. People should read them too.

## Set up

```sh
npm ci
cp .env.example .env.local     # then fill in development values, see below
DATABASE_URL="file:./dev.db" npx prisma migrate deploy   # creates prisma/dev.db
npm run dev                    # http://localhost:3737
```

`.env.local` needs at least `DATABASE_URL="file:./dev.db"`, `AUTH_SECRET` and `ENCRYPTION_KEY` (any local
values, e.g. `openssl rand -base64 32`). The Next.js server reads `.env.local`; the Prisma CLI does **not** —
give it `DATABASE_URL` on the command line, as above.

Sign in locally in one of two ways:

- **Like production** — the cabinet's one-time code against a local stand-in for the SkillKlan backend:
  `npm run dev:backend`, see [docs/contracts/local-backend.md](./docs/contracts/local-backend.md). Use this
  for anything about sign-in, roles, access or admin features.
- **Quick** — `JOBSYNC_DEV_PASSWORD_LOGIN=1` in `.env.local` enables upstream email + password sign-in and
  sign-up in development builds (never in production builds).

Never point a local setup at production (`api.`, `app.` or `jobs.skillklan.com.ua`), and never put real
student data into a local database.

## Branches and pull requests

1. Branch `sk/<topic>` from the latest `main`. One topic per pull request.
2. Before opening the PR run what CI runs, plus types:
   `npx prisma generate && npm run lint && npm test && npx tsc --noEmit`.
3. The PR description says **what** changed, **why**, and **how you verified it** (commands and results;
   for UI — what you checked in the browser).
4. Merge it yourself once the checks are green — unless it touches a path in
   [.github/CODEOWNERS](./.github/CODEOWNERS) (instructions, docs, CI and deploy, migrations, dependencies,
   license): then it waits for the owner's review.
5. A merge into `main` is a release. Your merge is deployed after the owner approves it in Telegram, so keep
   `main` deployable.

Nobody but the owner pushes to `main` directly, and nobody force-pushes a shared branch.

## Tests

Tests come from the requirement, not from the code: write down what the right result is and why, then the
test, and make sure it fails on the broken version — for the reason it is about. Run the whole suite before
you start and note what already fails. Details: [CLAUDE.md](./CLAUDE.md#tests).

## Dependencies

Adding an npm package needs the owner's approval — ask before `npm install <package>`. Security updates of
existing packages are welcome as their own PRs.

## Backend contracts

This app talks to the SkillKlan backend only through the contracts in [docs/contracts/](./docs/contracts/README.md).
If a feature needs data the contracts don't give, propose a new endpoint there — the owner builds the backend
side.
