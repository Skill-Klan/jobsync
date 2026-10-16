// @vitest-environment node
// Requirement — the feature switches table arrives with the image's own
// `migrate deploy` (rules §2.5: schema changes by migration, with tests):
// an existing install upgrades without losing anyone, and the table starts
// empty, so Activities is off by its default (owner 2026-10-16) — not by a
// row someone would have to remember to seed.
// Real migration history, real Prisma CLI.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
// The newest migration on main before the switches: what production runs now.
const LAST_BEFORE = "20261015120000_user_last_login_at";

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

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-feature-toggle-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

it("upgrade: the table appears empty, people stay", async () => {
  const url = `file:${path.join(dir, "upgrade.db")}`;
  prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);
  const before = new PrismaClient({ datasources: { db: { url } } });
  try {
    await before.$executeRawUnsafe(
      `INSERT INTO "User" (id, name, email, password, cabinetUserId) VALUES ('u1', 'Студент', 'cabinet-7@users.jobs.skillklan.invalid', '-', 7)`,
    );
  } finally {
    await before.$disconnect();
  }

  prisma(["migrate", "deploy"], url);

  const after = new PrismaClient({ datasources: { db: { url } } });
  try {
    const columns = await after.$queryRawUnsafe<{ name: string; notnull: bigint; pk: bigint }[]>(
      `PRAGMA table_info("FeatureToggle")`,
    );
    expect(columns.map((c) => [c.name, Number(c.notnull), Number(c.pk)])).toEqual([
      ["key", 1, 1],
      ["enabled", 1, 0],
      ["updatedAt", 1, 0],
      ["updatedByCabinetUserId", 0, 0],
    ]);
    expect(await after.featureToggle.count()).toBe(0);
    expect((await after.user.findMany({ select: { id: true } })).map((u) => u.id)).toEqual(["u1"]);
  } finally {
    await after.$disconnect();
  }
}, 120_000);
