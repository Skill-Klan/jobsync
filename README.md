# SkillKlan Job

Job search tracker for SkillKlan students and graduates — jobs, resumes, contacts, interview recordings — at
`jobs.skillklan.com.ua`. People sign in from the SkillKlan cabinet; the interface is Ukrainian with an English switch.

A **modified version of [JobSync](https://github.com/Gsync/jobsync)** by gsync, used under the MIT License (see
[`LICENSE`](./LICENSE), which must stay in this repository and in the image). Developed on its own since 2026-10-14;
nothing is merged from upstream.

## Start here

- [`CLAUDE.md`](./CLAUDE.md) — rules, commands and pitfalls (for people and AI agents alike).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — local setup, sign-in, pull requests.
- [`docs/`](./docs/README.md) — the owner's decisions, the interface glossary, the contracts with the SkillKlan
  backend, feature switches, the interview recordings library.

## What is on

| Part | State |
|---|---|
| Sign-in | only from the SkillKlan cabinet, with a one-time code; access re-checked at least every 5 minutes; own sign-up and passwords are off in production — [contract](./docs/contracts/backend-login.md) |
| Who comes in | students, the admin and the QA moderator (backend roles); the admin and the QA moderator manage the app |
| Jobs, resumes, contacts, tasks, questions | on |
| «Співбесіди» | the interview recordings library, listening only — [details](./docs/interview-recordings.md) |
| Automations, Activities, Library | off by default, switched in Settings → «Функції» — [details](./docs/feature-switches.md) |
| AI | not connected yet: SkillKlan's own key, billing and limits come with the backend (J4) |
| Admin statistics | a machine API the SkillKlan backend reads — [contract](./docs/contracts/admin-stats.md) |

## Where things are

| Path | What |
|---|---|
| `src/skillklan/` | SkillKlan integrations: cabinet sign-in, admin API, feature switches, recordings |
| `src/` (the rest) | the app, inherited from JobSync and changed in place |
| `prisma/` | SQLite schema and migrations |
| `skillklan/` | image entrypoint, deploy and server scripts, their tests, the local backend (`skillklan/dev/`) |
| `docs/` | documentation for contributors |

## Release

- **A push or merge into `main` is a release.** Lint, tests and the image smoke test run in parallel; when all are
  green, the tested image is published to `ghcr.io/skill-klan/jobsync` and deployed **by digest**. The server copies
  `/data`, starts the new image and rolls back — image and data — if it is not healthy within 3 minutes.
- **Approval:** the owner's pushes deploy right away; anyone else's merge waits for the owner's approval in Telegram
  (no approval, no deploy). Pull requests that touch paths in [`.github/CODEOWNERS`](./.github/CODEOWNERS) need the
  owner's review before they can be merged.
- **Manual deploy** of a digest (redeploy, rollback) is for the owner only; tick `ask` to get the Telegram button anyway.
  The same digest again is a no-op unless the server's settings changed.
- The deploy key and the button's secret live in the GitHub environment `server2`, which only `main` may use.

Workflows: [`ci.yml`](./.github/workflows/ci.yml), [`skillklan-image.yml`](./.github/workflows/skillklan-image.yml),
[`skillklan-deploy.yml`](./.github/workflows/skillklan-deploy.yml),
[`skillklan-deploy-scripts.yml`](./.github/workflows/skillklan-deploy-scripts.yml). Release notes:
[`CHANGELOG.md`](./CHANGELOG.md).

## License

MIT. Original work © 2024 gsync (JobSync). Modifications © SkillKlan. See [`LICENSE`](./LICENSE).
