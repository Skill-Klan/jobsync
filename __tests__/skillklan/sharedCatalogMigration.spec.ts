// @vitest-environment node
// Requirement — product notes, 2026-11-03: the shared catalog starts with
// something in it, so the pickers are not empty the day the switch goes on:
//   · the default job sources and default skills are there;
//   · a value that two or more accounts already use is there too (name: the
//     smallest label, so it is the same on every run); a value only one account
//     typed (a typo, a test skill) is not — the admin adds it on purpose;
//   · people's own rows and jobs are not touched.
// Real migration history, real Prisma CLI; no drift with schema.prisma.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SKILLS } from "@/lib/constants";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
const LAST_BEFORE = "20261103130000_default_skills";

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

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-catalog-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const labelsOf = async (db: PrismaClient, kind: string) =>
  Object.fromEntries((await db.catalogEntry.findMany({ where: { kind } })).map((e) => [e.value, e.label]));

describe("shared catalog migration", () => {
  it("upgrade: defaults and values two accounts share are seeded; one-account values and own rows are left", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);

    const before = new PrismaClient({ datasources: { db: { url } } });
    try {
      for (const id of ["a", "b"]) {
        await before.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
      }
      // «acme» is shared by both (labels differ: the smallest wins); «solo» and «пісь» are one person's.
      await before.company.create({ data: { id: "a-acme", label: "Acme Inc", value: "acme", createdBy: "a" } });
      await before.company.create({ data: { id: "b-acme", label: "ACME", value: "acme", createdBy: "b" } });
      await before.company.create({ data: { id: "a-solo", label: "Solo", value: "solo", createdBy: "a" } });
      await before.tag.create({ data: { id: "a-p", label: "пісь", value: "пісь", createdBy: "a" } });
      await before.location.create({ data: { id: "a-kyiv", label: "Kyiv", value: "kyiv", createdBy: "a" } });
      await before.location.create({ data: { id: "b-kyiv", label: "Kyiv", value: "kyiv", createdBy: "b" } });
    } finally {
      await before.$disconnect();
    }

    prisma(["migrate", "deploy"], url);

    const after = new PrismaClient({ datasources: { db: { url } } });
    try {
      expect(await after.catalogEntry.count({ where: { kind: "jobSource" } })).toBe(8);
      expect(await labelsOf(after, "skill")).toEqual(Object.fromEntries(DEFAULT_SKILLS.map((s) => [s.value, s.label])));
      expect(await labelsOf(after, "company")).toEqual({ acme: "ACME" });
      expect(await labelsOf(after, "location")).toEqual({ kyiv: "Kyiv" });
      expect(await after.catalogEntry.count({ where: { value: { in: ["solo", "пісь"] } } })).toBe(0);
      // own rows untouched
      expect(await after.company.count()).toBe(3);
      expect(await after.tag.count({ where: { value: "пісь" } })).toBe(1);
    } finally {
      await after.$disconnect();
    }
  }, 120_000);

  it("a clean database migrates, with the defaults in the catalog", async () => {
    const url = `file:${path.join(dir, "clean.db")}`;
    expect(() => prisma(["migrate", "deploy"], url)).not.toThrow();
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      expect(await db.catalogEntry.count({ where: { kind: "jobSource" } })).toBe(8);
      expect(await db.catalogEntry.count({ where: { kind: "skill" } })).toBe(DEFAULT_SKILLS.length);
    } finally {
      await db.$disconnect();
    }
  }, 120_000);

  it("leaves no drift between schema.prisma and the migration history", () => {
    const shadow = `file:${path.join(dir, "shadow.db")}`;
    const out = prisma(
      ["migrate", "diff", "--from-migrations", path.join(PRISMA_DIR, "migrations"), "--to-schema-datamodel", path.join(PRISMA_DIR, "schema.prisma"), "--shadow-database-url", shadow, "--script"],
      shadow,
    );
    expect(out).toMatch(/This is an empty migration/);
  }, 120_000);
});
