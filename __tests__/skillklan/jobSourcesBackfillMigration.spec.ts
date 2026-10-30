// @vitest-environment node
// Requirement — owner, 2026-10-30: the job sources every account starts with
// are the ones used on the Ukrainian market (see the defaults PR); the
// accounts that already exist are brought in line by a migration:
//   · DOU ("dou") and Djinni ("djinni") are added to every account, unless the
//     person already has them (their own, same value — no duplicate);
//   · Indeed, Monster, Glassdoor, ZipRecruiter and Job Street are removed;
//   · a job that pointed at a removed source now points at the person's
//     "Other" — created if the person had deleted it; a job with no source
//     stays without one; nothing else about a job changes;
//   · a source the person renamed (value of a removed board, another label)
//     is theirs and stays, with its jobs;
//   · Linkedin, Company Career page, Google, Other and the person's own
//     sources are untouched.
// Real migration history, real Prisma CLI; no drift with schema.prisma.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
// The newest migration on main before this one: what production runs now.
const LAST_BEFORE = "20261016120000_feature_toggle";

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

// What every account had before this change: the eleven old defaults.
const OLD_DEFAULTS = [
  ["Indeed", "indeed"],
  ["Linkedin", "linkedin"],
  ["Monster", "monster"],
  ["Glassdoor", "glassdoor"],
  ["Company Career page", "careerpage"],
  ["Google", "google"],
  ["ZipRecruiter", "ziprecruiter"],
  ["Job Street", "jobstreet"],
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

async function sourceValueOfJob(db: Db, jobId: string) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { JobSource: true } });
  return job.JobSource?.value ?? null;
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-job-sources-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("job sources backfill migration", () => {
  it("upgrade: accounts get DOU and Djinni, lose the foreign boards, keep every job and its data", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);

    const before = new PrismaClient({ datasources: { db: { url } } });
    try {
      await before.jobStatus.create({ data: { id: "status-draft", label: "Draft", value: "draft" } });

      // a: the plain case — all old defaults, jobs on a removed and a kept board, and none.
      await addUser(before, "a", OLD_DEFAULTS);
      await addJob(before, "a", "a-monster", "a-monster");
      await addJob(before, "a", "a-indeed", "a-indeed");
      await addJob(before, "a", "a-linkedin", "a-linkedin");
      await addJob(before, "a", "a-none", null);

      // b: already made their own "DOU" by hand — it is theirs, no duplicate.
      await addUser(before, "b", [...OLD_DEFAULTS, ["DOU", "dou"]]);

      // c: deleted "Other" and has a job on a removed board.
      await addUser(before, "c", OLD_DEFAULTS.filter(([, value]) => value !== "other"));
      await addJob(before, "c", "c-zip", "c-ziprecruiter");

      // d: renamed Monster to their own name; has a job on it and a source of their own.
      await addUser(before, "d", [
        ...OLD_DEFAULTS.filter(([, value]) => value !== "monster"),
        ["Біржа Ольги", "monster"],
        ["Telegram-канал", "telegram-канал"],
      ]);
      await addJob(before, "d", "d-renamed", "d-monster");
      await addJob(before, "d", "d-own", "d-telegram-канал");

      // e: an account with no sources at all (nothing was ever seeded).
      await addUser(before, "e", []);
    } finally {
      await before.$disconnect();
    }

    prisma(["migrate", "deploy"], url);

    const after = new PrismaClient({ datasources: { db: { url } } });
    try {
      const kept = {
        linkedin: "Linkedin",
        careerpage: "Company Career page",
        google: "Google",
        other: "Other",
        dou: "DOU",
        djinni: "Djinni",
      };

      expect(await sourcesOf(after, "a")).toEqual(kept);
      expect(await sourceValueOfJob(after, "a-monster")).toBe("other");
      expect(await sourceValueOfJob(after, "a-indeed")).toBe("other");
      expect(await sourceValueOfJob(after, "a-linkedin")).toBe("linkedin");
      expect(await sourceValueOfJob(after, "a-none")).toBeNull();
      const job = await after.job.findUniqueOrThrow({ where: { id: "a-monster" } });
      expect(job).toMatchObject({
        description: "description of a-monster",
        jobType: "FT",
        userId: "a",
        statusId: "status-draft",
        jobTitleId: "a-title",
        companyId: "a-company",
      });

      expect(await sourcesOf(after, "b")).toEqual(kept);
      expect(await after.jobSource.count({ where: { createdBy: "b", value: "dou" } })).toBe(1);

      expect(await sourcesOf(after, "c")).toEqual(kept);
      expect(await sourceValueOfJob(after, "c-zip")).toBe("other");

      expect(await sourcesOf(after, "d")).toEqual({ ...kept, monster: "Біржа Ольги", "telegram-канал": "Telegram-канал" });
      expect(await sourceValueOfJob(after, "d-renamed")).toBe("monster");
      expect(await sourceValueOfJob(after, "d-own")).toBe("telegram-канал");

      expect(await sourcesOf(after, "e")).toEqual({ dou: "DOU", djinni: "Djinni" });

      expect(await after.job.count()).toBe(7);
      expect(await after.user.count()).toBe(5);
    } finally {
      await after.$disconnect();
    }
  }, 120_000);

  it("a clean database migrates", () => {
    const url = `file:${path.join(dir, "clean.db")}`;
    expect(() => prisma(["migrate", "deploy"], url)).not.toThrow();
  }, 120_000);

  it("DOU and Djinni are unique per account, so a second one is refused", async () => {
    const url = `file:${path.join(dir, "twice.db")}`;
    prisma(["migrate", "deploy"], url);
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      await db.user.create({ data: { id: "u", name: "u", email: "u@test.invalid", password: "-" } });
      await db.jobSource.create({ data: { label: "DOU", value: "dou", createdBy: "u" } });
      await expect(db.jobSource.create({ data: { label: "DOU", value: "dou", createdBy: "u" } })).rejects.toThrow();
    } finally {
      await db.$disconnect();
    }
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
