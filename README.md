# SkillKlan JobSync

Job search tracker with AI assistance for SkillKlan students and graduates — applications, resumes,
contacts, interviews and automated job discovery. Served at `jobs.skillklan.com.ua`.

This is a **modified version of [JobSync](https://github.com/Gsync/jobsync)** by gsync, used under the
MIT License (see [`LICENSE`](./LICENSE), which must stay in this repository and in the image). Since
2026-10-14 it is developed independently and does not track upstream.

## What differs from upstream

- **Own container image** ([`Dockerfile`](./Dockerfile)): base image pinned by digest, runs as uid 1001
  from the start, Prisma CLI baked in (no downloads at startup), and the entrypoint
  ([`skillklan/docker-entrypoint.sh`](./skillklan/docker-entrypoint.sh)) refuses to start without a real
  `AUTH_SECRET` and `ENCRYPTION_KEY`.
- **Sign-in through the SkillKlan cabinet** ([`src/skillklan/`](./src/skillklan/)): the cabinet posts a
  one-time code to `/auth/cabinet`, the server trades it at the SkillKlan backend and re-checks access at
  least every 5 minutes (fail closed). Own sign-up and password sign-in are off in production builds.
- **Ukrainian interface** with an English switch; the MCP server is removed.
- **SkillKlan admin API** — numbers for the admin pages of the SkillKlan cabinet (see below).
- **Removed:** upstream deploy scripts (`curl | bash`), compose files with placeholder secrets, release and
  wiki workflows, Jenkinsfile, `evals/`.
- **Planned:** AI usage billing on the SkillKlan side.

## SkillKlan admin API

The SkillKlan backend reads per-person numbers for the cabinet's "Статистика Job" pages from a machine API
([`src/skillklan/adminApi.ts`](./src/skillklan/adminApi.ts), [`src/skillklan/adminStats.ts`](./src/skillklan/adminStats.ts)):

| Request | `data` |
|---|---|
| `GET /skillklan/admin/stats` | `{ users, unlinkedAccounts, generatedAt }` — everyone who came in from the cabinet |
| `GET /skillklan/admin/stats/:cabinetUserId` | `{ user \| null, generatedAt }` — never came in → `null`, not 404 |

- **Numbers only** per person: jobs (total, marked applied, per status), interviews (the Interviews page's own
  definition), resumes, cover letters, automations (and active), tasks, activities, contacts, questions, first
  and last sign-in. No job titles, companies, notes or resume text.
- **Outside `/api` on purpose** (like `/auth/cabinet`): the session middleware never sees these routes; the
  only way in is the `X-Jobsync-Admin-Secret` header equal to `JOBSYNC_ADMIN_API_SECRET` — a different secret
  from `JOBSYNC_API_SECRET`. Unset or shorter than 32 characters → `503`, wrong → `401`; constant-time compare;
  `Cache-Control: no-store`.
- `User.lastLoginAt` is stamped on every cabinet sign-in. Sessions last at most 8 hours, so it doubles as
  "last seen" without a database write per request.
- The contract lives with its consumer: the SkillKlan backend's `documentation/05-api/JOBSYNC_ADMIN_API.md`.

## Development

```sh
npm ci
npx prisma generate
npm run dev        # http://localhost:3737
npm run lint
npm test
```

## Image and release

- [`.github/workflows/skillklan-image.yml`](./.github/workflows/skillklan-image.yml) builds the image on every
  pull request into `main` and runs [`skillklan/tests/image-smoke.sh`](./skillklan/tests/image-smoke.sh)
  (requirements R1–R5: starts without network, non-root, migrations applied, placeholder or empty secrets
  refused). The same script must fail on the original upstream image — a guard against a vacuous test.
- Images are published only for `sk-*` tags to `ghcr.io/skill-klan/jobsync` and deployed **by digest**.

## License

MIT. Original work © 2024 gsync (JobSync). Modifications © SkillKlan. See [`LICENSE`](./LICENSE).
