---
paths:
  - "__tests__/**"
  - "e2e/**"
  - "skillklan/tests/**"
  - "vitest.setup.ts"
---

# Writing tests here

- Start each requirement test with a comment that states the requirement and where it comes from
  (a decision number, a contract, an issue) — then the expected value, then the code.
- Vitest runs in `jsdom` by default; server code (route handlers, Prisma CLI, crypto) wants
  `// @vitest-environment node` on the first line.
- Tests render in English unless you call `setTestLocale("uk")` (`__tests__/helpers/i18n.ts`). The
  `useTranslations` mock must return the same translator for the same section (it is cached) — a fresh
  function per render loops effects.
- Mock the backend at the `fetch` level with the real response shapes from `docs/contracts/`, or run
  `skillklan/dev/backend-stub.mjs` in-process — it answers like the backend, including refusals. A mock that
  accepts anything proves nothing about the contract.
- A "not called" assertion needs a paired "called" case in the same setup, or it passes for the wrong reason.
- `AbortSignal.timeout` does not fire under fake timers; test timeouts with a real short deadline or an
  injectable clock.
- Mutation check by hand: break the line you just wrote on a copy of the file, run the one spec, see it fail for
  the right reason, restore from the copy. Anchor the pattern on code, not on a comment that repeats it.
- e2e (Playwright) is not run by CI; run it locally against `npm run dev` when you change a flow.
- Shell tests for deploy scripts (`skillklan/tests/*.test.sh`) need Linux tools (`flock`, nginx) — CI runs them.
