// @vitest-environment node
// Requirement — product notes, 2026-11-03: new accounts start with the default
// skills (DEFAULT_SKILLS); a migration brings the accounts that already exist
// in line:
//   · every account gets each default skill it does not have a tag for — an
//     account with its own tag under the same value (any label) keeps its own,
//     no duplicate, and the jobs on it stay on it;
//   · tags of their own that are not defaults are left alone;
//   · nothing else changes: the jobs, the people themselves;
//   · the list in the migration is the list in the code.
// Real migration history, real Prisma CLI; no drift with schema.prisma.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SKILLS } from "@/lib/constants";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
const MIGRATION = "20261103130000_default_skills";
// The newest migration on main before this one: what production runs now.
const LAST_BEFORE = "20261102202050_plans";

function prisma(args: string[], url: string): string {
  return execFileSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  }).toString();
}

function stageMigrations(dir: string, keep: (name: string) => boolean): string {
  const target = path.join(dir, "prisma");
  fs.mkdirSync(path.join(target, "migrations"), { recursive: true });
  fs.copyFileSync(path.join(PRISMA_DIR, "schema.prisma"), path.join(target, "schema.prisma"));
  const migrations = path.join(PRISMA_DIR, "migrations");
  for (const name of fs.readdirSync(migrations)) {
    const from = path.join(migrations, name);
    if (fs.statSync(from).isDirectory()) {
      if (keep(name)) fs.cpSync(from, path.join(target, "migrations", name), { recursive: true });
    } else {
      fs.copyFileSync(from, path.join(target, "migrations", name));
    }
  }
  return path.join(target, "schema.prisma");
}

type Db = PrismaClient;

async function addUser(db: Db, id: string) {
  await db.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
}

async function tagsOf(db: Db, userId: string) {
  const rows = await db.tag.findMany({ where: { createdBy: userId } });
  return Object.fromEntries(rows.map((r) => [r.value, r.label]));
}

const DEFAULTS = Object.fromEntries(DEFAULT_SKILLS.map((s) => [s.value, s.label]));

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-default-skills-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("default skills backfill migration", () => {
  it("the list in the migration is the list in the code", () => {
    const sql = fs.readFileSync(path.join(PRISMA_DIR, "migrations", MIGRATION, "migration.sql"), "utf8");
    const pairs = [...sql.matchAll(/SELECT '([^']+)'(?: AS "label")?, '([^']+)'/g)].map((m) => [m[2], m[1]]);
    expect(Object.fromEntries(pairs)).toEqual(DEFAULTS);
    expect(pairs).toHaveLength(DEFAULT_SKILLS.length);
  });

  it("upgrade: accounts get every default once, keep everything else", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);

    const before = new PrismaClient({ datasources: { db: { url } } });
    try {
      await before.jobStatus.create({ data: { id: "status-draft", label: "Draft", value: "draft" } });

      // a: no tags at all.
      await addUser(before, "a");

      // b: has "Java" under another label, with a job on it, and a tag of their own.
      await addUser(before, "b");
      await before.tag.create({ data: { id: "b-java", label: "Моя Java", value: "java", createdBy: "b" } });
      await before.tag.create({ data: { id: "b-own", label: "Rust", value: "rust", createdBy: "b" } });
      await before.jobTitle.create({ data: { id: "b-title", label: "Dev", value: "dev", createdBy: "b" } });
      await before.company.create({ data: { id: "b-company", label: "Acme", value: "acme", createdBy: "b" } });
      await before.job.create({
        data: {
          id: "b-job",
          userId: "b",
          description: "description of b-job",
          jobType: "FT",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          statusId: "status-draft",
          jobTitleId: "b-title",
          companyId: "b-company",
          tags: { connect: [{ id: "b-java" }] },
        },
      });
    } finally {
      await before.$disconnect();
    }

    prisma(["migrate", "deploy"], url);

    const after = new PrismaClient({ datasources: { db: { url } } });
    try {
      expect(await tagsOf(after, "a")).toEqual(DEFAULTS);
      expect(await tagsOf(after, "b")).toEqual({ ...DEFAULTS, java: "Моя Java", rust: "Rust" });
      for (const user of ["a", "b"]) {
        expect(await after.tag.count({ where: { createdBy: user, value: "java" } })).toBe(1);
      }

      // the job is still on the tag the person made
      const job = await after.job.findUniqueOrThrow({ where: { id: "b-job" }, include: { tags: true } });
      expect(job.tags.map((t) => t.id)).toEqual(["b-java"]);
      expect(await after.user.count()).toBe(2);
      expect(await after.job.count()).toBe(1);
    } finally {
      await after.$disconnect();
    }
  }, 120_000);

  it("a clean database migrates", () => {
    const url = `file:${path.join(dir, "clean.db")}`;
    expect(() => prisma(["migrate", "deploy"], url)).not.toThrow();
  }, 120_000);

  // Schema and migration history must describe the same database, or the
  // next `migrate dev` writes a surprise migration of its own.
  it("leaves no drift between schema.prisma and the migration history", () => {
    const shadow = `file:${path.join(dir, "shadow.db")}`;
    const out = prisma(
      [
        "migrate",
        "diff",
        "--from-migrations",
        path.join(PRISMA_DIR, "migrations"),
        "--to-schema-datamodel",
        path.join(PRISMA_DIR, "schema.prisma"),
        "--shadow-database-url",
        shadow,
        "--script",
      ],
      shadow,
    );
    expect(out).toMatch(/This is an empty migration/);
  }, 120_000);
});
