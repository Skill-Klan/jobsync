// @vitest-environment node
// Requirement — Jira SKD-42 / SKD-43 (the owner's data-migration task):
// a student's copy of a plan is frozen when it is issued, but the templates were
// rewritten afterwards (the school's updated sheets). One data migration moves every
// issued plan to the current template of its track:
//   · after it, each plan is exactly the current template: same tree, titles,
//     order and links;
//   · an item that has a place in the new plan keeps its id, its tick, its
//     doneAt and its note; a homework follows its topic, a sub-task keeps its
//     number (ДЗ numbers shifted when new homeworks were added);
//   · an item of the new plan that nothing matched is added, not done;
//   · an old item with no place and no progress is dropped; with a tick or a
//     note it is never dropped silently: the migration fails and changes nothing;
//   · no Plan row is added or removed, and plans of other tracks stay as they are.
// Real migration history, real Prisma CLI, plans seeded from the old template
// files as they were in git (the fixtures), the way assignPlan made them.
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { getPlanTemplate, PlanNode } from "@/skillklan/plans/template";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_DIR = path.join(ROOT, "prisma");
const FIXTURES = path.join(__dirname, "fixtures/plans");
// The newest migration before the one under test: what production runs now.
const LAST_BEFORE = "20261103140000_shared_catalog";

// Which template version every issued copy could come from.
const OLD_PLANS = [
  { user: "java-v1", track: "java", file: "java.5104eb4.json" },
  { user: "java-v2", track: "java", file: "java.2115292.json" },
  { user: "java-v3", track: "java", file: "java.751ae49.json" },
  { user: "js", track: "javascript", file: "javascript.751ae49.json" },
  { user: "py", track: "python", file: "python.751ae49.json" },
  { user: "manual", track: "manual", file: "manual.751ae49.json" },
] as const;

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

async function withDb<T>(url: string, run: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await run(db);
  } finally {
    await db.$disconnect();
  }
}

type Row = { id: string; planId: string; parentId: string | null; kind: string; title: string; position: number; materialUrl: string | null };

// Stores a template the way assignPlan did when it was issued.
async function issue(db: PrismaClient, userId: string, track: string, template: { title: string; children: PlanNode[] }) {
  const plan = await db.plan.create({ data: { userId, track, title: template.title } });
  const rows: Row[] = [];
  const flatten = (nodes: PlanNode[], parentId: string | null) =>
    nodes.forEach((node, position) => {
      const id = randomUUID();
      rows.push({ id, planId: plan.id, parentId, kind: node.kind, title: node.title, position, materialUrl: node.materialUrl ?? null });
      flatten(node.children ?? [], id);
    });
  flatten(template.children, null);
  await db.planItem.createMany({ data: rows });
  return plan.id;
}

// A plan as a tree of what a student sees, to compare with a template.
interface Shape {
  kind: string;
  title: string;
  materialUrl?: string;
  children: Shape[];
}
async function shapeOf(db: PrismaClient, planId: string): Promise<Shape[]> {
  const rows = await db.planItem.findMany({ where: { planId }, orderBy: { position: "asc" } });
  const build = (parentId: string | null): Shape[] =>
    rows
      .filter((r) => r.parentId === parentId)
      .map((r) => ({ kind: r.kind, title: r.title, ...(r.materialUrl ? { materialUrl: r.materialUrl } : {}), children: build(r.id) }));
  return build(null);
}
const shapeOfTemplate = (nodes: PlanNode[]): Shape[] =>
  nodes.map((n) => ({ kind: n.kind, title: n.title, ...(n.materialUrl ? { materialUrl: n.materialUrl } : {}), children: shapeOfTemplate(n.children ?? []) }));

// The id of the row at a path of titles (module → topic → … → point).
async function idAt(db: PrismaClient, planId: string, titles: string[]): Promise<string> {
  let parentId: string | null = null;
  for (const title of titles) {
    const row: { id: string } = await db.planItem.findFirstOrThrow({ where: { planId, parentId, title } });
    parentId = row.id;
  }
  return parentId!;
}

const JAVA_M1 = "Модуль 1. Основи тестування + Java Basics (3–4 тижні)";
const CASES = [JAVA_M1, "Тема 2: Тест-кейси, баг-репорти, чеклісти", "Тест-кейси", "Що таке тест-кейс, з чого складається."];
const API_TOPIC = ["Модуль 4: API Testing — Postman + RestAssured (3 тижні)", "Тема 1: Введення в API"];
const API_HW_OLD = "ДЗ 13";
const HW1 = [JAVA_M1, "Тема 1: SDLC, STLC, Agile, Scrum", "ДЗ 1"];

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-plans-templates-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Production as it was: the migrations before this one, plans issued from the old templates.
async function productionBefore(name: string, seed: (db: PrismaClient) => Promise<void>): Promise<string> {
  const url = `file:${path.join(dir, `${name}.db`)}`;
  prisma(["migrate", "deploy", "--schema", stageMigrations(path.join(dir, `before-${name}`), (n) => n <= LAST_BEFORE)], url);
  await withDb(url, async (db) => {
    for (const { user } of OLD_PLANS) await db.user.create({ data: { id: user, name: user, email: `${user}@test.invalid`, password: "-" } });
    await seed(db);
  });
  return url;
}

const oldTemplate = (file: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8")) as { title: string; children: PlanNode[] };

describe("the issued plans move to the updated templates", () => {
  let url: string;
  let plans: Record<string, string>;
  let before: Record<string, Set<string>>;
  let ticked: { cases: string; api: string; hw1Task1: string };
  let javaOtherTrack: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-plans-templates-"));
    plans = {};
    before = {};
    url = await productionBefore("main", async (db) => {
      for (const p of OLD_PLANS) plans[p.user] = await issue(db, p.user, p.track, oldTemplate(p.file));
      // a plan of a track nobody has a template for: it must stay as it is
      const other = await db.plan.create({ data: { userId: "js", track: "go", title: "Go" } });
      const m = await db.planItem.create({ data: { planId: other.id, kind: "module", title: "Модуль 1", position: 0 } });
      await db.planItem.create({ data: { planId: other.id, parentId: m.id, kind: "topic", title: "Тема 1", position: 0, done: true, note: "лишається" } });
      javaOtherTrack = other.id;
      // progress of the student with the oldest Java copy
      const p = plans["java-v1"];
      const cases = await idAt(db, p, CASES);
      const hw1 = await idAt(db, p, HW1);
      const hwTask = (await db.planItem.findFirstOrThrow({ where: { parentId: hw1 }, orderBy: { position: "asc" } })).id;
      const apiHw = await idAt(db, p, [...API_TOPIC, API_HW_OLD]);
      const apiTask = (await db.planItem.findFirstOrThrow({ where: { parentId: apiHw }, orderBy: { position: "asc" } })).id;
      const when = new Date("2026-11-04T10:00:00.000Z");
      await db.planItem.update({ where: { id: cases }, data: { done: true, doneAt: when, note: "зробила" } });
      await db.planItem.update({ where: { id: hwTask }, data: { done: true, doneAt: when } });
      await db.planItem.update({ where: { id: apiTask }, data: { note: "уточнити у ментора" } });
      ticked = { cases, hw1Task1: hwTask, api: apiTask };
      for (const p of OLD_PLANS) before[p.user] = new Set((await db.planItem.findMany({ where: { planId: plans[p.user] }, select: { id: true } })).map((i) => i.id));
    });
    prisma(["migrate", "deploy"], url);
  }, 180_000);
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("is red without the migration: the issued Java copy has the old eight modules", async () => {
    // Requirement: the issued copies differ from the updated template — that is why the migration exists.
    const oldShape = shapeOfTemplate(oldTemplate("java.751ae49.json").children);
    expect(oldShape).toHaveLength(8);
    expect(shapeOfTemplate(getPlanTemplate("java")!.children)).toHaveLength(9);
  });

  it.each(OLD_PLANS)("$user ($track, $file): the plan is exactly the current template", async ({ user, track }) => {
    await withDb(url, async (db) => {
      expect(await shapeOf(db, plans[user])).toEqual(shapeOfTemplate(getPlanTemplate(track)!.children));
    });
  });

  it("keeps the tick, doneAt and note of an item that has a place, and its id; the title is the new one", async () => {
    await withDb(url, async (db) => {
      const item = await db.planItem.findUniqueOrThrow({ where: { id: ticked.cases } });
      expect(item).toMatchObject({
        planId: plans["java-v1"],
        kind: "item",
        title: "Що таке тест-кейс, з чого складається",
        done: true,
        note: "зробила",
      });
      expect(item.doneAt?.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    });
  });

  it("a sub-task keeps its number: ДЗ 1 task 1 is still task 1, now in the new words", async () => {
    await withDb(url, async (db) => {
      const task = await db.planItem.findUniqueOrThrow({ where: { id: ticked.hw1Task1 } });
      expect(task).toMatchObject({ kind: "homework_task", title: "1. SDLC: що це і навіщо; 6 етапів з прикладом дії тестувальника на кожному", done: true });
      expect(task.doneAt?.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    });
  });

  it("a homework follows its topic, not its number: API intro was ДЗ 13, is ДЗ 15", async () => {
    await withDb(url, async (db) => {
      const task = await db.planItem.findUniqueOrThrow({ where: { id: ticked.api } });
      expect(task).toMatchObject({ kind: "homework_task", title: "1. Що таке API, HTTP, REST; REST vs SOAP", note: "уточнити у ментора" });
      const homework = await db.planItem.findUniqueOrThrow({ where: { id: task.parentId! } });
      expect(homework.title).toBe("ДЗ 15");
      const topic = await db.planItem.findUniqueOrThrow({ where: { id: homework.parentId! } });
      expect(topic.title).toBe("Тема 1: Введення в API");
    });
  });

  it("adds what is new, not done: the AI module and the new GitHub Actions topic", async () => {
    await withDb(url, async (db) => {
      const planId = plans["java-v3"];
      const ai = await db.planItem.findFirstOrThrow({ where: { planId, kind: "module", title: { startsWith: "Модуль 8: AI для QA" } } });
      expect(before["java-v3"].has(ai.id)).toBe(false);
      const added = await db.planItem.findMany({ where: { planId, id: { notIn: [...before["java-v3"]] } } });
      expect(added.length).toBeGreaterThan(0);
      expect(added.every((i) => i.done === false && i.doneAt === null && i.note === null)).toBe(true);
    });
  });

  it("drops an old item with no place and no progress: ДЗ 1 has five tasks now, not seven", async () => {
    await withDb(url, async (db) => {
      const hw = await db.planItem.findFirstOrThrow({ where: { planId: plans["java-v1"], kind: "homework", title: "ДЗ 1" } });
      expect(await db.planItem.count({ where: { parentId: hw.id } })).toBe(5);
    });
  });

  it("changes no Plan row: same people, same tracks, nothing added or removed", async () => {
    await withDb(url, async (db) => {
      const all = await db.plan.findMany({ orderBy: [{ userId: "asc" }, { track: "asc" }] });
      expect(all.map((p) => `${p.userId}:${p.track}`)).toEqual(
        [...OLD_PLANS.map((p) => `${p.user}:${p.track}`), "js:go"].sort(),
      );
      expect(all.map((p) => p.id).sort()).toEqual([...Object.values(plans), javaOtherTrack].sort());
    });
  });

  it("leaves a plan of another track as it was", async () => {
    await withDb(url, async (db) => {
      const items = await db.planItem.findMany({ where: { planId: javaOtherTrack }, orderBy: { position: "asc" } });
      expect(items.map((i) => [i.title, i.done, i.note])).toEqual([
        ["Модуль 1", false, null],
        ["Тема 1", true, "лишається"],
      ]);
    });
  });

  it("every old item that still exists kept its own plan: nothing moved between students", async () => {
    await withDb(url, async (db) => {
      for (const { user } of OLD_PLANS) {
        const now = await db.planItem.findMany({ where: { id: { in: [...before[user]] } }, select: { planId: true } });
        expect(now.length).toBeGreaterThan(0);
        expect(now.every((i) => i.planId === plans[user])).toBe(true);
      }
    });
  });
});

describe("the guard", () => {
  // Requirement (SKD-43): nothing with progress is lost silently; if it would be, the migration fails.
  it("an old item with a tick and no place fails the migration and changes nothing", async () => {
    let planId = "";
    let lostTask = "";
    const url = await productionBefore("guard", async (db) => {
      planId = await issue(db, "java-v1", "java", oldTemplate("java.5104eb4.json"));
      const hw = await idAt(db, planId, HW1);
      // task 6 of ДЗ 1 («Назви чотири основні ролі…») is not in the new ДЗ 1, which has five tasks
      const tasks = await db.planItem.findMany({ where: { parentId: hw }, orderBy: { position: "asc" } });
      expect(tasks).toHaveLength(7);
      lostTask = tasks[6].id;
      await db.planItem.update({ where: { id: lostTask }, data: { done: true } });
    });
    let before = 0;
    await withDb(url, async (db) => {
      before = await db.planItem.count({ where: { planId } });
    });

    // the guard is a CHECK on a temp table: the failure names it, not some other error
    let failure = "";
    try {
      prisma(["migrate", "deploy"], url);
    } catch (e) {
      failure = String((e as { stderr?: Buffer }).stderr ?? e);
    }
    expect(failure).toMatch(/CHECK constraint failed/);

    await withDb(url, async (db) => {
      expect(await db.planItem.count({ where: { planId } })).toBe(before);
      expect(await db.planItem.findUniqueOrThrow({ where: { id: lostTask } })).toMatchObject({ done: true, title: expect.stringMatching(/^6\. /) });
      expect(await shapeOf(db, planId)).toEqual(shapeOfTemplate(oldTemplate("java.5104eb4.json").children));
    });
  }, 180_000);

  it("the same plan without that tick moves fine (paired case)", async () => {
    let planId = "";
    const url = await productionBefore("guard-ok", async (db) => {
      planId = await issue(db, "java-v1", "java", oldTemplate("java.5104eb4.json"));
    });
    prisma(["migrate", "deploy"], url);
    await withDb(url, async (db) => {
      expect(await shapeOf(db, planId)).toEqual(shapeOfTemplate(getPlanTemplate("java")!.children));
    });
  }, 180_000);

  it("a plan already on the new template stays as it is", async () => {
    let planId = "";
    let ids: string[] = [];
    const url = await productionBefore("already", async (db) => {
      planId = await issue(db, "java-v1", "java", getPlanTemplate("java")!);
      await db.planItem.updateMany({ where: { planId, kind: "item" }, data: { done: true } });
      ids = (await db.planItem.findMany({ where: { planId }, select: { id: true } })).map((i) => i.id).sort();
    });
    prisma(["migrate", "deploy"], url);
    await withDb(url, async (db) => {
      const now = await db.planItem.findMany({ where: { planId } });
      expect(now.map((i) => i.id).sort()).toEqual(ids);
      expect(now.filter((i) => i.kind === "item").every((i) => i.done)).toBe(true);
      expect(await shapeOf(db, planId)).toEqual(shapeOfTemplate(getPlanTemplate("java")!.children));
    });
  }, 180_000);
});
