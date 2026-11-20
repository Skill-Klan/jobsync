// @vitest-environment node
// Requirement — transcripts of the interview recordings (owner 2026-11-20,
// D104–D106) arrive with the image's own `migrate deploy` (rules §2.5: schema
// changes by migration, with tests):
//   · an existing install upgrades without losing anyone or anything, and the
//     new table starts empty — no transcript exists before someone asks;
//   · one transcript per recording, shared by everyone: a second row for the
//     same recording is refused by the database itself;
//   · the transcript outlives the person who asked for it: their account goes,
//     the text stays for everyone (only the link to them is cleared);
//   · schema.prisma and the migrations describe the same database (no drift).
// Real migration history, real Prisma CLI.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
// The newest migration on main before the transcripts: what production runs now.
const LAST_BEFORE = "20261116120000_plans_updated_templates";

function prisma(args: string[], url: string): void {
  execFileSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
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

async function withDb<T>(url: string, run: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await run(db);
  } finally {
    await db.$disconnect();
  }
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-transcripts-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

it("upgrade: the table appears empty, people and their switches stay", async () => {
  const url = `file:${path.join(dir, "upgrade.db")}`;
  prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);
  await withDb(url, async (db) => {
    await db.$executeRawUnsafe(
      `INSERT INTO "User" (id, name, email, password, cabinetUserId) VALUES ('u1', 'Студент', 'cabinet-7@users.jobs.skillklan.invalid', '-', 7)`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "FeatureToggle" (key, enabled, updatedAt) VALUES ('questions', 1, CURRENT_TIMESTAMP)`,
    );
  });

  prisma(["migrate", "deploy"], url);

  await withDb(url, async (db) => {
    const columns = await db.$queryRawUnsafe<{ name: string; notnull: bigint; pk: bigint }[]>(
      `PRAGMA table_info("RecordingTranscript")`,
    );
    expect(columns.map((c) => [c.name, Number(c.notnull), Number(c.pk)])).toEqual([
      ["recordingId", 1, 1],
      ["status", 1, 0],
      ["segments", 0, 0],
      ["languageCode", 0, 0],
      ["durationSecs", 0, 0],
      ["model", 0, 0],
      ["failure", 0, 0],
      ["requestedById", 0, 0],
      ["createdAt", 1, 0],
      ["updatedAt", 1, 0],
      ["startedAt", 0, 0],
      ["finishedAt", 0, 0],
    ]);
    expect(await db.recordingTranscript.count()).toBe(0);
    expect((await db.user.findMany({ select: { id: true } })).map((u) => u.id)).toEqual(["u1"]);
    expect(await db.featureToggle.findMany({ select: { key: true, enabled: true } })).toEqual([
      { key: "questions", enabled: true },
    ]);
  });
}, 120_000);

it("one transcript per recording; it stays when the person who asked is gone", async () => {
  const url = `file:${path.join(dir, "fresh.db")}`;
  prisma(["migrate", "deploy"], url);

  await withDb(url, async (db) => {
    await db.user.create({ data: { id: "u1", name: "Студент", email: "u1@test.invalid", password: "-" } });
    await db.recordingTranscript.create({
      data: { recordingId: "drive-file-0000001", status: "done", segments: "[]", requestedById: "u1" },
    });

    // The same recording again — the database itself refuses a second row.
    await expect(
      db.recordingTranscript.create({ data: { recordingId: "drive-file-0000001", status: "queued", requestedById: "u1" } }),
    ).rejects.toThrow();

    await db.user.delete({ where: { id: "u1" } });
    expect(await db.recordingTranscript.findMany({ select: { recordingId: true, status: true, requestedById: true } })).toEqual([
      { recordingId: "drive-file-0000001", status: "done", requestedById: null },
    ]);
  });
}, 120_000);

it("schema.prisma and the migrations describe the same database", () => {
  const url = `file:${path.join(dir, "drift.db")}`;
  prisma(["migrate", "deploy"], url);
  // --exit-code: 0 — no difference, 2 — a difference (execFileSync throws on it).
  expect(() =>
    prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", path.join(PRISMA_DIR, "schema.prisma"), "--exit-code"], url),
  ).not.toThrow();
}, 120_000);
