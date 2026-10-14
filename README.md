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
- **Removed:** upstream deploy scripts (`curl | bash`), compose files with placeholder secrets, release and
  wiki workflows, Jenkinsfile, `evals/`.
- **Planned:** sign-in through the SkillKlan cabinet (own sign-up disabled), AI usage billing on the
  SkillKlan side, MCP server removed.

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
