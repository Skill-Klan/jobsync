// @vitest-environment node
// Requirement — product notes, 2026-11-02: a student has their own copy of a
// plan template (Java, Python, …): module → topic → subtopic → point, with a
// tick and a note on each. The copy is created once per student and track,
// is frozen when created, and is the student's alone:
//   · a plan belongs to one person and is one of their tracks — a person
//     cannot have two plans of the same track, two people can;
//   · a plan is a tree of items; deleting a plan or an item takes everything
//     below it, and nothing above or beside it;
//   · an item starts not done, with no note;
//   · the migration changes no existing data: people stay, the tables start empty.
// Real migration history, real Prisma CLI; no drift with schema.prisma.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
// The newest migration on main before the plans: what production runs now.
const LAST_BEFORE = "20261102120000_job_sources_work_robota";

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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-plans-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function withDb<T>(url: string, run: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await run(db);
  } finally {
    await db.$disconnect();
  }
}

async function addUser(db: PrismaClient, id: string) {
  await db.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
}

describe("plans migration", () => {
  it("upgrade: people stay, the plan tables start empty", async () => {
    const url = `file:${path.join(dir, "upgrade.db")}`;
    prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, "before"), (n) => n <= LAST_BEFORE)], url);
    await withDb(url, async (db) => {
      await db.$executeRawUnsafe(
        `INSERT INTO "User" (id, name, email, password, cabinetUserId) VALUES ('u1', 'Студент', 'cabinet-7@users.jobs.skillklan.invalid', '-', 7)`,
      );
    });

    prisma(["migrate", "deploy"], url);

    await withDb(url, async (db) => {
      expect((await db.user.findMany({ select: { id: true } })).map((u) => u.id)).toEqual(["u1"]);
      expect(await db.plan.count()).toBe(0);
      expect(await db.planItem.count()).toBe(0);
    });
  }, 120_000);

  it("a person has one plan per track; another person may have the same track", async () => {
    const url = `file:${path.join(dir, "unique.db")}`;
    prisma(["migrate", "deploy"], url);
    await withDb(url, async (db) => {
      await addUser(db, "a");
      await addUser(db, "b");
      await db.plan.create({ data: { userId: "a", track: "java", title: "Java" } });

      await expect(db.plan.create({ data: { userId: "a", track: "java", title: "Java again" } })).rejects.toThrow(
        /Unique constraint/,
      );
      await db.plan.create({ data: { userId: "a", track: "python", title: "Python" } });
      await db.plan.create({ data: { userId: "b", track: "java", title: "Java" } });

      expect(await db.plan.count()).toBe(3);
    });
  }, 120_000);

  it("a plan is a tree: an item starts not done, and deleting takes only what is below", async () => {
    const url = `file:${path.join(dir, "tree.db")}`;
    prisma(["migrate", "deploy"], url);
    await withDb(url, async (db) => {
      await addUser(db, "a");
      await addUser(db, "b");
      const plan = await db.plan.create({ data: { userId: "a", track: "java", title: "Java" } });
      const other = await db.plan.create({ data: { userId: "b", track: "java", title: "Java" } });

      const add = (planId: string, kind: string, title: string, position: number, parentId?: string) =>
        db.planItem.create({ data: { planId, kind, title, position, parentId } });

      const module1 = await add(plan.id, "module", "Модуль 1", 0);
      const topic1 = await add(plan.id, "topic", "Тема 1", 0, module1.id);
      const topic2 = await add(plan.id, "topic", "Тема 2", 1, module1.id);
      const group = await add(plan.id, "group", "SDLC", 0, topic1.id);
      await add(plan.id, "item", "Що таке SDLC", 0, group.id);
      await add(plan.id, "item", "Що таке тест-кейс", 0, topic2.id);
      await add(other.id, "module", "Модуль 1", 0);

      const fresh = await db.planItem.findUniqueOrThrow({ where: { id: group.id } });
      expect(fresh).toMatchObject({ done: false, doneAt: null, note: null, materialUrl: null, parentId: topic1.id });

      // deleting a topic takes its subtree, not its sibling or its parent
      await db.planItem.delete({ where: { id: topic1.id } });
      const left = (await db.planItem.findMany({ where: { planId: plan.id }, orderBy: { title: "asc" } })).map((i) => i.title);
      expect(left).toEqual(["Модуль 1", "Тема 2", "Що таке тест-кейс"]);
      expect(await db.planItem.count({ where: { planId: other.id } })).toBe(1);

      // deleting a plan takes all its items and nobody else's
      await db.plan.delete({ where: { id: plan.id } });
      expect(await db.planItem.count({ where: { planId: plan.id } })).toBe(0);
      expect(await db.planItem.count({ where: { planId: other.id } })).toBe(1);
    });
  }, 120_000);

  it("an item needs a real plan and a real parent", async () => {
    const url = `file:${path.join(dir, "fk.db")}`;
    prisma(["migrate", "deploy"], url);
    await withDb(url, async (db) => {
      await addUser(db, "a");
      const plan = await db.plan.create({ data: { userId: "a", track: "java", title: "Java" } });

      await expect(
        db.planItem.create({ data: { planId: "nope", kind: "module", title: "x", position: 0 } }),
      ).rejects.toThrow();
      await expect(
        db.planItem.create({ data: { planId: plan.id, parentId: "nope", kind: "topic", title: "x", position: 0 } }),
      ).rejects.toThrow();
      expect(await db.planItem.count()).toBe(0);
    });
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
