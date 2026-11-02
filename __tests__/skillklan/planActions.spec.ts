// @vitest-environment node
// Requirement — product notes, 2026-11-02 and the owner's switch rule (D73,
// D74 — a switched-off part refuses on the server too):
//   · a student ticks off and annotates points and homework tasks of their own
//     plan, and nothing else: not a module, a topic or a group, not someone
//     else's plan;
//   · the manager (admin or QA moderator, as the backend says right now) gives
//     a student a plan; a student, a demoted admin, a backend that says no or
//     does not answer, or no session — nothing is given;
//   · the manager takes a plan back (a mistake, or a graduate): the copy goes
//     with its ticks and notes, nobody else's plan is touched, and the same plan
//     can be given again; the same refusals as for giving;
//   · the study plan is behind its own switch `plans`, off at launch: while off,
//     every action refuses — and another switch being on does not help;
//   · the list of students shows names and plan tracks, no e-mail, no password.
// Real SQLite with the current schema, real Prisma; the backend is a fake.
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return {
    url,
    dir,
    session: { value: null as null | { user: { id: string; isAdmin?: boolean } } },
    access: vi.fn(),
    revalidate: vi.fn(),
  };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("@/skillklan/cabinetApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/skillklan/cabinetApi")>()),
  getCabinetAccess: ctx.access,
}));
vi.mock("next/cache", () => ({ revalidatePath: ctx.revalidate }));

import {
  assignStudentPlan,
  getMyPlans,
  listPlanStudents,
  removeStudentPlan,
  setPlanItemDone,
  setPlanItemNote,
} from "@/actions/plan.actions";
import { assignPlan } from "@/skillklan/plans/assignPlan";
import { PLAN_NOTE_MAX } from "@/skillklan/plans/tree";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

let ann: string;
let bob: string;
let manager: string;

const asStudent = (id: string) => (ctx.session.value = { user: { id, isAdmin: false } });
const asManager = () => (ctx.session.value = { user: { id: manager, isAdmin: true } });
const setSwitch = (key: string, enabled: boolean) =>
  prisma.featureToggle.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
const firstOf = (userId: string, kind: string) =>
  prisma.planItem.findFirstOrThrow({ where: { plan: { userId }, kind }, orderBy: { id: "asc" } });

beforeAll(async () => {
  const make = (name: string, cabinetUserId: number) =>
    prisma.user.create({
      data: { name, email: `cabinet-${cabinetUserId}@users.jobs.skillklan.invalid`, password: "-", cabinetUserId },
    });
  ann = (await make("Анна", 1)).id;
  bob = (await make("Богдан", 2)).id;
  manager = (await make("Менеджер", 42)).id;
});

beforeEach(async () => {
  await prisma.plan.deleteMany();
  await prisma.featureToggle.deleteMany();
  await setSwitch("plans", true);
  await assignPlan(prisma, ann, "java");
  await assignPlan(prisma, bob, "java");
  ctx.access.mockReset();
  ctx.revalidate.mockReset();
  asStudent(ann);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("ticking and annotating — a student's own points only", () => {
  it("ticks a point: done, with the time; unticks: both back", async () => {
    const item = await firstOf(ann, "item");
    await expect(setPlanItemDone(item.id, true)).resolves.toEqual({ success: true });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ done: true, doneAt: expect.any(Date) });
    await expect(setPlanItemDone(item.id, false)).resolves.toEqual({ success: true });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ done: false, doneAt: null });
  });

  it("ticks a homework task too", async () => {
    const task = await firstOf(ann, "homework_task");
    await expect(setPlanItemDone(task.id, true)).resolves.toEqual({ success: true });
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: task.id } })).done).toBe(true);
  });

  it("someone else's point: not found, nothing changes — and Bob's own plan is untouched by Anna", async () => {
    const bobs = await firstOf(bob, "item");
    await expect(setPlanItemDone(bobs.id, true)).resolves.toMatchObject({ success: false });
    await expect(setPlanItemNote(bobs.id, "чужа нотатка")).resolves.toMatchObject({ success: false });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: bobs.id } })).toMatchObject({ done: false, note: null });
  });

  it.each(["module", "topic", "group", "homework", "homework_ref"])(
    "a %s cannot be ticked or annotated — it is done by its parts",
    async (kind) => {
      const item = await firstOf(ann, kind);
      await expect(setPlanItemDone(item.id, true)).resolves.toMatchObject({ success: false });
      await expect(setPlanItemNote(item.id, "x")).resolves.toMatchObject({ success: false });
      expect(await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ done: false, note: null });
    },
  );

  it.each([
    ["an unknown id", "nope", true],
    ["no id", undefined, true],
    ["not a boolean", "__REAL__", "yes"],
  ])("%s — refused", async (_label, id, done) => {
    const item = await firstOf(ann, "item");
    await expect(setPlanItemDone(id === "__REAL__" ? item.id : id, done)).resolves.toMatchObject({ success: false });
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(false);
  });

  it("no session — nothing is written", async () => {
    const item = await firstOf(ann, "item");
    ctx.session.value = null;
    await expect(setPlanItemDone(item.id, true)).resolves.toMatchObject({ success: false });
    await expect(setPlanItemNote(item.id, "x")).resolves.toMatchObject({ success: false });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ done: false, note: null });
  });

  it("a note is trimmed and stored; an empty one clears it; a note of exactly the limit fits", async () => {
    const item = await firstOf(ann, "item");
    await setPlanItemNote(item.id, "  розібрався  ");
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).note).toBe("розібрався");
    await setPlanItemNote(item.id, "   ");
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).note).toBeNull();
    await expect(setPlanItemNote(item.id, "я".repeat(PLAN_NOTE_MAX))).resolves.toEqual({ success: true });
  });

  it("a note over the limit, or not text, is refused and the old note stays", async () => {
    const item = await firstOf(ann, "item");
    await setPlanItemNote(item.id, "стара");
    await expect(setPlanItemNote(item.id, "я".repeat(PLAN_NOTE_MAX + 1))).resolves.toMatchObject({ success: false });
    await expect(setPlanItemNote(item.id, 42)).resolves.toMatchObject({ success: false });
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).note).toBe("стара");
  });
});

describe("reading my plan", () => {
  it("is my plan as a tree and nobody else's", async () => {
    const result = await getMyPlans();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ track: "java", title: "Java" });
    expect(result.data[0].modules).toHaveLength(8);
    expect(result.data[0].modules.every((m) => m.kind === "module")).toBe(true);
    const bobsPlan = await prisma.plan.findFirstOrThrow({ where: { userId: bob } });
    expect(result.data.map((p) => p.id)).not.toContain(bobsPlan.id);
  });

  it("a student with no plan gets an empty list; no session gets a refusal", async () => {
    await prisma.plan.deleteMany({ where: { userId: ann } });
    await expect(getMyPlans()).resolves.toEqual({ success: true, data: [] });
    ctx.session.value = null;
    await expect(getMyPlans()).resolves.toMatchObject({ success: false });
  });
});

describe("the `plans` switch", () => {
  it("off → every action refuses and writes nothing; the backend is not asked", async () => {
    const item = await firstOf(ann, "item");
    await setSwitch("plans", false);
    asManager();
    const before = await prisma.plan.count();
    for (const result of [
      await getMyPlans(),
      await setPlanItemDone(item.id, true),
      await setPlanItemNote(item.id, "x"),
      await listPlanStudents(),
      await assignStudentPlan(manager, "java"),
    ]) {
      expect(result).toEqual({ success: false, message: expect.any(String) });
    }
    expect(await prisma.plan.count()).toBe(before);
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ done: false, note: null });
    expect(ctx.access).not.toHaveBeenCalled();
  });

  it("no row at all is off — the launch state", async () => {
    await prisma.featureToggle.deleteMany();
    await expect(getMyPlans()).resolves.toMatchObject({ success: false });
  });

  it("another switch being on does not open it — only `plans` does", async () => {
    await prisma.featureToggle.deleteMany();
    for (const key of ["automations", "activities", "library"]) await setSwitch(key, true);
    await expect(getMyPlans()).resolves.toMatchObject({ success: false });
    await setSwitch("plans", true);
    await expect(getMyPlans()).resolves.toMatchObject({ success: true });
  });
});

describe("the list of students — the manager only", () => {
  it("shows names, cabinet numbers and tracks held; no e-mail, no password; the tracks to give", async () => {
    asManager();
    const result = await listPlanStudents();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tracks).toEqual([{ track: "java", title: "Java" }]);
    expect(result.data.students.find((s) => s.id === ann)).toEqual({ id: ann, name: "Анна", cabinetUserId: 1, tracks: ["java"], plans: [{ track: "java", done: 0, notes: 0 }] });
    expect(result.data.students.find((s) => s.id === manager)?.tracks).toEqual([]);
    expect(JSON.stringify(result.data)).not.toMatch(/@|password/);
  });

  it("a student — refused", async () => {
    asStudent(ann);
    await expect(listPlanStudents()).resolves.toMatchObject({ success: false });
  });

  it("no session — refused", async () => {
    ctx.session.value = null;
    await expect(listPlanStudents()).resolves.toMatchObject({ success: false });
  });
});

describe("giving a plan — the backend is asked now", () => {
  beforeEach(async () => {
    await prisma.plan.deleteMany({ where: { userId: ann } });
    asManager();
  });

  it.each(["admin", "qa_moderator"])("%s gives Anna the Java plan", async (role) => {
    ctx.access.mockResolvedValue({ allowed: true, role });
    await expect(assignStudentPlan(ann, "java")).resolves.toEqual({ success: true });
    expect(await prisma.plan.count({ where: { userId: ann, track: "java" } })).toBe(1);
    expect(ctx.access).toHaveBeenCalledWith(42);
    expect(ctx.revalidate).toHaveBeenCalledWith("/dashboard/student-plans");
  });

  it.each([
    ["the session says admin, the backend says student (demoted)", { allowed: true, role: "student" }],
    ["a mentor", { allowed: true, role: "mentor" }],
    ["the backend no longer lets the person in", { allowed: false, role: null }],
    ["an allowed person with no known role", { allowed: true, role: null }],
  ])("%s — nothing given", async (_label, answer) => {
    ctx.access.mockResolvedValue(answer);
    await expect(assignStudentPlan(ann, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: ann } })).toBe(0);
  });

  it("the backend did not answer — fail closed", async () => {
    ctx.access.mockRejectedValue(new Error("timeout"));
    await expect(assignStudentPlan(ann, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: ann } })).toBe(0);
  });

  it("a student calling it for themselves — the backend says student, nothing given", async () => {
    asStudent(bob);
    await prisma.plan.deleteMany({ where: { userId: bob } });
    ctx.access.mockResolvedValue({ allowed: true, role: "student" });
    await expect(assignStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(0);
  });

  it("no session — the backend is not even asked", async () => {
    ctx.session.value = null;
    await expect(assignStudentPlan(ann, "java")).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown track", ann, "python"],
    ["an unknown student", "nobody", "java"],
    ["not text", 7, "java"],
  ])("%s — refused with a reason, nothing given", async (_label, id, track) => {
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    await expect(assignStudentPlan(id, track)).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: ann } })).toBe(0);
  });

  it("a second time — refused, the first copy and its ticks stay", async () => {
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    await assignStudentPlan(ann, "java");
    const item = await firstOf(ann, "item");
    await prisma.planItem.update({ where: { id: item.id }, data: { done: true } });
    await expect(assignStudentPlan(ann, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: ann } })).toBe(1);
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(true);
  });
});

describe("the list tells what taking a plan back would lose", () => {
  it("counts the ticked points and the notes of each plan", async () => {
    asManager();
    const items = await prisma.planItem.findMany({ where: { plan: { userId: ann }, kind: "item" }, take: 3, orderBy: { id: "asc" } });
    await prisma.planItem.updateMany({ where: { id: { in: items.slice(0, 2).map((i) => i.id) } }, data: { done: true } });
    await prisma.planItem.update({ where: { id: items[2].id }, data: { note: "q" } });
    const result = await listPlanStudents();
    if (!result.success) throw new Error("refused");
    expect(result.data.students.find((s) => s.id === ann)?.plans).toEqual([{ track: "java", done: 2, notes: 1 }]);
  });
});

describe("taking a plan back — the backend is asked now", () => {
  beforeEach(async () => {
    await prisma.plan.deleteMany({ where: { userId: bob } });
    await assignPlan(prisma, bob, "java");
    asManager();
  });

  it.each(["admin", "qa_moderator"])("%s takes Bob's plan back with all its points; Anna's stays", async (role) => {
    ctx.access.mockResolvedValue({ allowed: true, role });
    const annItems = await prisma.planItem.count({ where: { plan: { userId: ann } } });
    await expect(removeStudentPlan(bob, "java")).resolves.toEqual({ success: true });
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(0);
    expect(await prisma.planItem.count({ where: { plan: { userId: bob } } })).toBe(0);
    expect(await prisma.planItem.count({ where: { plan: { userId: ann } } })).toBe(annItems);
    expect(ctx.revalidate).toHaveBeenCalledWith("/dashboard/student-plans");
  });

  it("then the same plan can be given again, fresh", async () => {
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    const item = await firstOf(bob, "item");
    await prisma.planItem.update({ where: { id: item.id }, data: { done: true, note: "x" } });
    await removeStudentPlan(bob, "java");
    await expect(assignStudentPlan(bob, "java")).resolves.toEqual({ success: true });
    expect(await prisma.planItem.count({ where: { plan: { userId: bob }, OR: [{ done: true }, { note: { not: null } }] } })).toBe(0);
  });

  it.each([
    ["the session says admin, the backend says student (demoted)", { allowed: true, role: "student" }],
    ["a mentor", { allowed: true, role: "mentor" }],
    ["the backend no longer lets the person in", { allowed: false, role: null }],
  ])("%s — nothing taken back", async (_label, answer) => {
    ctx.access.mockResolvedValue(answer);
    await expect(removeStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(1);
  });

  it("the backend did not answer — fail closed", async () => {
    ctx.access.mockRejectedValue(new Error("timeout"));
    await expect(removeStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(1);
  });

  it("a student taking back their own plan — refused", async () => {
    asStudent(bob);
    ctx.access.mockResolvedValue({ allowed: true, role: "student" });
    await expect(removeStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(1);
  });

  it("no session — the backend is not even asked", async () => {
    ctx.session.value = null;
    await expect(removeStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(1);
  });

  it("the switch off — refused before the backend is asked", async () => {
    await setSwitch("plans", false);
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    await expect(removeStudentPlan(bob, "java")).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
    expect(await prisma.plan.count({ where: { userId: bob } })).toBe(1);
  });

  it.each([
    ["a student without that plan", ann, "python"],
    ["not text", 7, "java"],
  ])("%s — refused, nothing removed", async (_label, id, track) => {
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    await expect(removeStudentPlan(id, track)).resolves.toMatchObject({ success: false });
    expect(await prisma.plan.count({ where: { userId: { in: [ann, bob] } } })).toBe(2);
  });
});
