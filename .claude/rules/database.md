---
paths:
  - "prisma/**"
  - "src/lib/db.ts"
---

# Database (Prisma + SQLite)

- Change the schema **only with a migration** (`npx prisma migrate dev --name <what>`), never by editing an
  applied migration. Migrations need the owner's review (CODEOWNERS) — keep them in a small PR of their own.
- Every migration gets a test that runs the **real migration history with the real Prisma CLI**: a clean
  database, an upgrade of a database that already has data (nothing lost), and no drift between
  `schema.prisma` and the migrations. Pattern: `__tests__/skillklan/featureToggleMigration.spec.ts`.
- No tables or columns for access, roles, money, prices, limits or the admin log — those live in the backend.
  Defaults for feature switches live in code (`src/skillklan/features.ts`); the table keeps only the admin's
  choices, so a migration never seeds "off" rows.
- SQLite means **one instance**: it grows vertically. Avoid long write transactions; watch for
  `database is locked`. Moving to another database is the owner's decision, not a refactor.
- Resumes and notes are personal data: no real data in fixtures, seeds, screenshots or logs.
