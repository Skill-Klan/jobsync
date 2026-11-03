// @vitest-environment node
// Requirement — product notes, 2026-11-02: the manager gives a student their
// own copy of a track's template:
//   · the copy has every module, topic, subtopic, point and homework task of
//     the template, in the template's order, none ticked and no notes;
//   · it is the student's alone — ticking in one copy changes no other;
//   · one copy per student and track: a second request does not duplicate it
//     and does not reset what the student has done;
//   · an unknown track or an unknown student creates nothing.
// Real migrations on a real SQLite file; the template is the real Java one.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { assignPlan } from "@/skillklan/plans/assignPlan";
import { getPlanTemplate, PlanNode } from "@/skillklan/plans/template";

const ROOT = path.resolve(__dirname, "../..");
let dir: string;
let db: PrismaClient;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobsync-assign-"));
  const url = `file:${path.join(dir, "assign.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  db = new PrismaClient({ datasources: { db: { url } } });
  for (const id of ["a", "b"]) await db.user.create({ data: { id, name: id, email: `${id}@test.invalid`, password: "-" } });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Titles of the template in reading order with their depth, counted by hand-walk.
function outline(nodes: PlanNode[], depth = 0): string[] {
  return nodes.flatMap((n) => [`${depth}|${n.kind}|${n.title}`, ...outline(n.children ?? [], depth + 1)]);
}

type Row = { id: string; parentId: string | null; kind: string; title: string; position: number };
function outlineOfCopy(rows: Row[], parentId: string | null = null, depth = 0): string[] {
  return rows
    .filter((r) => r.parentId === parentId)
    .sort((x, y) => x.position - y.position)
    .flatMap((r) => [`${depth}|${r.kind}|${r.title}`, ...outlineOfCopy(rows, r.id, depth + 1)]);
}

describe("assignPlan", () => {
  const java = getPlanTemplate("java")!;

  it("gives the student the whole Java template, in order, nothing ticked", async () => {
    const result = await assignPlan(db, "a", "java");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = await db.plan.findUniqueOrThrow({ where: { id: result.planId } });
    expect(plan).toMatchObject({ userId: "a", track: "java", title: "Java" });

    const rows = await db.planItem.findMany({ where: { planId: plan.id } });
    expect(outlineOfCopy(rows)).toEqual(outline(java.children));
    expect(result.items).toBe(rows.length);
    // siblings are numbered 0, 1, 2… so the order is stored, not left to chance
    const byParent = new Map<string | null, number[]>();
    for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r.position]);
    for (const positions of byParent.values()) {
      expect(positions.sort((x, y) => x - y)).toEqual(positions.map((_, i) => i));
    }
    expect(rows.every((r) => !r.done && r.doneAt === null && r.note === null)).toBe(true);
    // every link to a material survives
    const links = (n: PlanNode[]): number => n.reduce((s, x) => s + (x.materialUrl ? 1 : 0) + links(x.children ?? []), 0);
    expect(rows.filter((r) => r.materialUrl).length).toBe(links(java.children));
  }, 60_000);

  it.each(["javascript", "python", "manual"])("gives the student the whole %s template too, in order", async (track) => {
    const template = getPlanTemplate(track)!;
    const result = await assignPlan(db, "b", track);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = await db.planItem.findMany({ where: { planId: result.planId } });
    expect(outlineOfCopy(rows)).toEqual(outline(template.children));
    expect((await db.plan.findUniqueOrThrow({ where: { id: result.planId } })).title).toBe(template.title);
    // «Java» and «JavaScript» are different plans of one student
    expect(await db.plan.count({ where: { userId: "b", track } })).toBe(1);
  }, 60_000);

  it("is the student's alone: ticking in one copy does not touch another", async () => {
    const second = await assignPlan(db, "b", "java");
    expect(second.ok).toBe(true);
    const mine = await db.planItem.findFirstOrThrow({ where: { plan: { userId: "a" }, kind: "item" } });
    await db.planItem.update({ where: { id: mine.id }, data: { done: true, note: "розібрався" } });

    expect(await db.planItem.count({ where: { plan: { userId: "b" }, done: true } })).toBe(0);
    expect(await db.planItem.count({ where: { plan: { userId: "b" }, note: { not: null } } })).toBe(0);
    // the two copies hold different rows
    const ids = await db.planItem.findMany({ where: { plan: { userId: { in: ["a", "b"] } } }, select: { id: true } });
    expect(new Set(ids.map((i) => i.id)).size).toBe(ids.length);
  }, 60_000);

  it("a second request is refused and keeps what the student has done", async () => {
    const before = await db.planItem.count({ where: { plan: { userId: "a" } } });
    expect(await assignPlan(db, "a", "java")).toEqual({ ok: false, reason: "already_assigned" });
    expect(await db.plan.count({ where: { userId: "a" } })).toBe(1);
    expect(await db.planItem.count({ where: { plan: { userId: "a" } } })).toBe(before);
    expect(await db.planItem.count({ where: { plan: { userId: "a" }, done: true, note: "розібрався" } })).toBe(1);
  });

  it("two requests at once make one copy", async () => {
    await db.user.create({ data: { id: "c", name: "c", email: "c@test.invalid", password: "-" } });
    const results = await Promise.all([assignPlan(db, "c", "java"), assignPlan(db, "c", "java")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "already_assigned" }]);
    expect(await db.plan.count({ where: { userId: "c" } })).toBe(1);
  }, 60_000);

  it("an unknown track or an unknown student creates nothing", async () => {
    const plans = await db.plan.count();
    const items = await db.planItem.count();
    expect(await assignPlan(db, "a", "go")).toEqual({ ok: false, reason: "unknown_track" });
    expect(await assignPlan(db, "a", "constructor")).toEqual({ ok: false, reason: "unknown_track" });
    expect(await assignPlan(db, "nobody", "java")).toEqual({ ok: false, reason: "unknown_user" });
    expect(await db.plan.count()).toBe(plans);
    expect(await db.planItem.count()).toBe(items);
  });
});
