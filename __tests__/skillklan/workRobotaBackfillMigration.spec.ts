// @vitest-environment node
// Requirement — owner, 2026-10-30: Work.ua ("work.ua") and Robota.ua
// ("robota.ua") are job sources every account has (the defaults PR covers new
// accounts); a migration brings the accounts that already exist in line:
//   · both are added to every account that does not have a source with that
//     value — an account with its own "work.ua" (any label) keeps its own,
//     no duplicate;
//   · nothing else changes: the other sources, the jobs and their sources,
//     the people themselves.
// Real migration history, real Prisma CLI; no drift with schema.prisma.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
// The newest migration on main before this one: what production runs now.
const LAST_BEFORE = "20261030120000_job_sources_ukraine";

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

// What every account has before this change: the previous migration's defaults.
const BEFORE = [
  ["Linkedin", "linkedin"],
  ["DOU", "dou"],
  ["Djinni", "djinni"],
  ["Google", "google"],
  ["Company Career page", "careerpage"],
  ["Other", "other"],
] as const;

type Db = PrismaClient;

async function addUser(db: Db, id: string, sources: readonly (readonly [string, string])[]) {
  await db.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
  for (const [label, value] of sources) {
    await db.jobSource.create({ data: { id: `${id}-${value}`, label, value, createdBy: id } });
  }
  await db.jobTitle.create({ data: { id: `${id}-title`, label: "Dev", value: "dev", createdBy: id } });
  await db.company.create({ data: { id: `${id}-company`, label: "Acme", value: "acme", createdBy: id } });
}

async function addJob(db: Db, userId: string, id: string, sourceId: string | null) {
  await db.job.create({
    data: {
      id,
      userId,
      description: `description of ${id}`,
      jobType: "FT",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      statusId: "status-draft",
      jobTitleId: `${userId}-title`,
      companyId: `${userId}-company`,
      jobSourceId: sourceId,
    },
  });
}

async function sourcesOf(db: Db, userId: string) {
  const rows = await db.jobSource.findMany({ where: { createdBy: userId } });
  return Object.fromEntries(rows.map((r) => [r.value, r.label]));
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-work-robota-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Work.ua and Robota.ua backfill migration", () => {
  it("upgrade: accounts get both boards once, keep everything else", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);

    const before = new PrismaClient({ datasources: { db: { url } } });
    try {
      await before.jobStatus.create({ data: { id: "status-draft", label: "Draft", value: "draft" } });

      // a: the plain case — the six defaults, a job on a kept board and one on none.
      await addUser(before, "a", BEFORE);
      await addJob(before, "a", "a-linkedin", "a-linkedin");
      await addJob(before, "a", "a-none", null);

      // b: made their own "Work.ua" by hand — theirs, no duplicate.
      await addUser(before, "b", [...BEFORE, ["Work.ua", "work.ua"]]);
      await addJob(before, "b", "b-work", "b-work.ua");

      // c: has a source of their own under Robota's value, with their own label.
      await addUser(before, "c", [...BEFORE, ["Моя Робота", "robota.ua"]]);

      // d: an account with no sources at all.
      await addUser(before, "d", []);
    } finally {
      await before.$disconnect();
    }

    prisma(["migrate", "deploy"], url);

    const after = new PrismaClient({ datasources: { db: { url } } });
    try {
      const kept = Object.fromEntries(BEFORE.map(([label, value]) => [value, label]));
      const both = { "work.ua": "Work.ua", "robota.ua": "Robota.ua" };

      expect(await sourcesOf(after, "a")).toEqual({ ...kept, ...both });
      expect(await sourcesOf(after, "b")).toEqual({ ...kept, ...both });
      expect(await sourcesOf(after, "c")).toEqual({ ...kept, ...both, "robota.ua": "Моя Робота" });
      expect(await sourcesOf(after, "d")).toEqual(both);
      for (const user of ["a", "b", "c", "d"]) {
        expect(await after.jobSource.count({ where: { createdBy: user, value: "work.ua" } })).toBe(1);
        expect(await after.jobSource.count({ where: { createdBy: user, value: "robota.ua" } })).toBe(1);
      }

      // jobs and their sources are as they were
      const jobs = await after.job.findMany({ include: { JobSource: true }, orderBy: { id: "asc" } });
      expect(jobs.map((j) => [j.id, j.JobSource?.value ?? null])).toEqual([
        ["a-linkedin", "linkedin"],
        ["a-none", null],
        ["b-work", "work.ua"],
      ]);
      expect(await after.user.count()).toBe(4);
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
