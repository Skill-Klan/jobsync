// @vitest-environment node
// Requirement — docs/contracts/study-plans-mentors.md, D89–D93, D98:
//   · a viewer looks at a student's plan only if the BACKEND's list for the
//     chosen entry (a mentor, or «Без ментора») has that student — the list is
//     asked again at that moment, so a changed id opens nobody else's plan;
//   · the viewer is the signed-in person (never an id from the browser); no
//     session, or an account with no cabinet id, sees nothing;
//   · fail closed: a list that could not be loaded gives a notice and no plan;
//   · the viewer may tick points and write notes in that student's plan, the same
//     fields the student uses (a chosen product decision, 2026-11-18, replaces
//     D92/D93 view-only) — and only there: not a student the backend's list
//     does not hold, not a point of another student's plan, not a module/topic;
//   · reading a plan writes nothing;
//   · a student who never signed in has no plan here — said so, not an error;
//   · calls within 30 s share one answer; a failed answer is not kept;
//   · the plans switch off → every action refuses (and on, the same call works).
// Real SQLite with the current schema, real Prisma; the backend is a fake.
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return {
    url,
    dir,
    session: { value: null as null | { user: { id: string } } },
    students: vi.fn(),
    without: vi.fn(),
    me: vi.fn(),
  };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/skillklan/cabinetApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/skillklan/cabinetApi")>()),
  listMentorStudents: ctx.students,
  listStudentsWithoutMentor: ctx.without,
  getViewerMentor: ctx.me,
}));

import {
  getEntryStudents,
  getStudentPlans,
  setStudentPlanItemDone,
  setStudentPlanItemNote,
} from "@/actions/plan.actions";
import { assignPlan } from "@/skillklan/plans/assignPlan";
import { PLAN_NOTE_MAX } from "@/skillklan/plans/tree";
import { ACCESS_SHARE_MS } from "@/skillklan/accessRecheck";
import { loadMentorLookup } from "@/skillklan/mentorPlans";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
const mentorEntry = { kind: "mentor", mentorId: 1004 };
const NONE = { kind: "none" };

let viewerUser: string;
let ann: string;
const as = (id: string | null) => (ctx.session.value = id ? { user: { id } } : null);
const setSwitch = (enabled: boolean) =>
  prisma.featureToggle.upsert({ where: { key: "plans" }, create: { key: "plans", enabled }, update: { enabled } });
const makeUser = (name: string, cabinetUserId: number | null) =>
  prisma.user.create({
    data: { name, email: `u-${name}-${cabinetUserId}@users.invalid`, password: "-", cabinetUserId },
  });

beforeAll(async () => {
  viewerUser = (await makeUser("Viewer", 42)).id;
  ann = (await makeUser("Анна", 1001)).id;
  await makeUser("Богдан", 1002);
  await makeUser("No cabinet", null);
});

beforeEach(async () => {
  // the shared 30 s answers belong to a process; every case starts without them
  (globalThis as { skillklanSharedMentorLists?: Map<string, unknown> }).skillklanSharedMentorLists?.clear();
  await prisma.plan.deleteMany();
  await prisma.featureToggle.deleteMany();
  await setSwitch(true);
  await assignPlan(prisma, ann, "java");
  ctx.students.mockReset().mockResolvedValue([{ userId: 1001, name: "Анна" }]);
  ctx.without.mockReset().mockResolvedValue([{ userId: 1002, name: "Богдан" }]);
  as(viewerUser);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("a list of students", () => {
  it("is the backend's answer for the signed-in viewer's cabinet id", async () => {
    const result = await getEntryStudents(mentorEntry);
    expect(result).toEqual({ success: true, data: { students: [{ userId: 1001, name: "Анна" }] } });
    expect(ctx.students).toHaveBeenCalledWith(42, 1004);

    expect(await getEntryStudents(NONE)).toMatchObject({ success: true, data: { students: [{ userId: 1002 }] } });
    expect(ctx.without).toHaveBeenCalledWith(42);
  });

  it("could not be loaded → a notice, not an empty list; an empty list is still a success", async () => {
    ctx.students.mockResolvedValue(null);
    expect(await getEntryStudents(mentorEntry)).toEqual({ success: false, message: expect.stringMatching(/could not be loaded/i) });
    ctx.students.mockResolvedValue([]);
    (globalThis as { skillklanSharedMentorLists?: Map<string, unknown> }).skillklanSharedMentorLists?.clear();
    expect(await getEntryStudents(mentorEntry)).toEqual({ success: true, data: { students: [] } });
  });

  it("no session, or an account with no cabinet id, sees nothing and the backend is not asked", async () => {
    as(null);
    expect((await getEntryStudents(mentorEntry)).success).toBe(false);
    as((await prisma.user.findFirstOrThrow({ where: { cabinetUserId: null } })).id);
    expect((await getEntryStudents(mentorEntry)).success).toBe(false);
    expect(ctx.students).not.toHaveBeenCalled();
  });

  it("an entry of the wrong shape is refused before the backend is asked", async () => {
    for (const bad of [null, "mentor", {}, { kind: "mentor" }, { kind: "mentor", mentorId: 0 }, { kind: "mentor", mentorId: "1" }, { kind: "all" }]) {
      expect((await getEntryStudents(bad)).success).toBe(false);
    }
    expect(ctx.students).not.toHaveBeenCalled();
  });
});

describe("a student's plan (view only)", () => {
  it("opens for a student on the backend's list, with the plan as it stands", async () => {
    const result = await getStudentPlans(mentorEntry, 1001);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ name: "Анна", hasAccount: true });
    expect(result.data.plans.map((p) => p.track)).toEqual(["java"]);
    expect(result.data.plans[0].modules.length).toBeGreaterThan(0);
  });

  it("a student who is not on that list stays closed — another mentor's, or a made-up id", async () => {
    expect((await getStudentPlans(mentorEntry, 1002)).success).toBe(false); // Богдан is «Без ментора»
    expect((await getStudentPlans(NONE, 1001)).success).toBe(false); // Анна has a mentor
    expect((await getStudentPlans(mentorEntry, 999999)).success).toBe(false);
    for (const bad of [0, -1, "1001", null, 1.5]) expect((await getStudentPlans(mentorEntry, bad)).success).toBe(false);
  });

  it("the list is asked for the plan too (a changed address opens nothing)", async () => {
    expect((await getStudentPlans(mentorEntry, 1001)).success).toBe(true);
    ctx.students.mockResolvedValue([]); // the backend stopped counting Анна as theirs
    (globalThis as { skillklanSharedMentorLists?: Map<string, unknown> }).skillklanSharedMentorLists?.clear();
    expect((await getStudentPlans(mentorEntry, 1001)).success).toBe(false);
  });

  it("a list that could not be loaded opens no plan", async () => {
    ctx.students.mockResolvedValue(null);
    expect(await getStudentPlans(mentorEntry, 1001)).toMatchObject({ success: false });
  });

  it("a student who never signed in has no plan here — said as such", async () => {
    ctx.students.mockResolvedValue([{ userId: 7777, name: "Ще не входив" }]);
    expect(await getStudentPlans(mentorEntry, 7777)).toEqual({
      success: true,
      data: { name: "Ще не входив", hasAccount: false, applications: null, plans: [] },
    });
  });

  it("changes nothing", async () => {
    const before = await prisma.planItem.count({ where: { done: true } });
    await getStudentPlans(mentorEntry, 1001);
    expect(await prisma.planItem.count({ where: { done: true } })).toBe(before);
  });
});

describe("one answer per 30 s", () => {
  afterEach(() => vi.restoreAllMocks());

  it("two calls for the same viewer and list ask the backend once; another list asks again", async () => {
    await getEntryStudents(mentorEntry);
    await getEntryStudents(mentorEntry);
    await getStudentPlans(mentorEntry, 1001);
    expect(ctx.students).toHaveBeenCalledTimes(1);
    await getEntryStudents({ kind: "mentor", mentorId: 1005 });
    expect(ctx.students).toHaveBeenCalledTimes(2);
  });

  it("after 30 s it asks again", async () => {
    const start = Date.now();
    await getEntryStudents(mentorEntry);
    vi.spyOn(Date, "now").mockReturnValue(start + ACCESS_SHARE_MS + 10_000);
    await getEntryStudents(mentorEntry);
    expect(ctx.students).toHaveBeenCalledTimes(2);
  });

  it("a failed answer is not kept: the next call asks again", async () => {
    ctx.students.mockResolvedValueOnce(null);
    expect((await getEntryStudents(mentorEntry)).success).toBe(false);
    expect((await getEntryStudents(mentorEntry)).success).toBe(true);
    expect(ctx.students).toHaveBeenCalledTimes(2);
  });
});

// Review SKD-68: «not a mentor» is an answer like any other and is shared for
// 30 s; only «the backend did not answer» is asked again at the next opening.
describe("«am I a mentor» is one answer per 30 s too", () => {
  it("a viewer who is not a mentor: the backend says so once, the second opening reuses it", async () => {
    ctx.me.mockResolvedValue({ mentor: null });
    expect((await loadMentorLookup(42, false)).me).toBeNull();
    expect((await loadMentorLookup(42, false)).me).toBeNull();
    expect(ctx.me).toHaveBeenCalledTimes(1);
  });

  it("a mentor is found, and also asked once", async () => {
    const mentor = { mentorId: 1004, name: "Test Mentor", direction: "QA" };
    ctx.me.mockResolvedValue({ mentor });
    expect((await loadMentorLookup(42, false)).me).toEqual(mentor);
    expect((await loadMentorLookup(42, false)).me).toEqual(mentor);
    expect(ctx.me).toHaveBeenCalledTimes(1);
  });

  it("a backend that did not answer is not kept: the next opening asks again and shows no «my students» meanwhile", async () => {
    ctx.me.mockResolvedValueOnce(null).mockResolvedValueOnce({ mentor: null });
    expect((await loadMentorLookup(42, false)).me).toBeNull();
    expect((await loadMentorLookup(42, false)).me).toBeNull();
    expect(ctx.me).toHaveBeenCalledTimes(2);
  });
});

describe("the plans switch", () => {
  it("off → every action refuses and the backend is not asked; on → the same calls work", async () => {
    await setSwitch(false);
    expect((await getEntryStudents(mentorEntry)).success).toBe(false);
    expect((await getStudentPlans(mentorEntry, 1001)).success).toBe(false);
    expect(ctx.students).not.toHaveBeenCalled();

    await setSwitch(true);
    expect((await getEntryStudents(mentorEntry)).success).toBe(true);
    expect((await getStudentPlans(mentorEntry, 1001)).success).toBe(true);
  });
});

describe("a viewer ticks and annotates a student's plan", () => {
  let bobId: string;
  const firstOf = (userId: string, kind: string) =>
    prisma.planItem.findFirstOrThrow({ where: { plan: { userId }, kind }, orderBy: { id: "asc" } });
  const row = (id: string) => prisma.planItem.findUniqueOrThrow({ where: { id } });

  beforeEach(async () => {
    bobId = (await prisma.user.findFirstOrThrow({ where: { cabinetUserId: 1002 } })).id;
    await assignPlan(prisma, bobId, "java");
  });

  it("ticks, unticks and annotates a point of a student from the backend's list", async () => {
    const item = await firstOf(ann, "item");
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, true)).resolves.toEqual({ success: true });
    expect(await row(item.id)).toMatchObject({ done: true, doneAt: expect.any(Date) });
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, false)).resolves.toEqual({ success: true });
    expect(await row(item.id)).toMatchObject({ done: false, doneAt: null });
    await expect(setStudentPlanItemNote(mentorEntry, 1001, item.id, "  перевірено  ")).resolves.toEqual({ success: true });
    expect((await row(item.id)).note).toBe("перевірено");
    await setStudentPlanItemNote(mentorEntry, 1001, item.id, "  ");
    expect((await row(item.id)).note).toBeNull();
  });

  it("a student the backend's list does not hold — refused, nothing written", async () => {
    const bobs = await firstOf(bobId, "item");
    await expect(setStudentPlanItemDone(mentorEntry, 1002, bobs.id, true)).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemNote(mentorEntry, 1002, bobs.id, "x")).resolves.toMatchObject({ success: false });
    expect(await row(bobs.id)).toMatchObject({ done: false, note: null });
  });

  it("a point of ANOTHER student's plan, named under an allowed student — not found", async () => {
    const bobs = await firstOf(bobId, "item");
    await expect(setStudentPlanItemDone(mentorEntry, 1001, bobs.id, true)).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemNote(mentorEntry, 1001, bobs.id, "x")).resolves.toMatchObject({ success: false });
    expect(await row(bobs.id)).toMatchObject({ done: false, note: null });
  });

  it.each(["module", "topic", "group", "homework", "homework_ref"])("a %s cannot be ticked or annotated", async (kind) => {
    const item = await firstOf(ann, kind);
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, true)).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemNote(mentorEntry, 1001, item.id, "x")).resolves.toMatchObject({ success: false });
    expect(await row(item.id)).toMatchObject({ done: false, note: null });
  });

  it("the backend did not answer — fail closed", async () => {
    const item = await firstOf(ann, "item");
    ctx.students.mockResolvedValue(null);
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, true)).resolves.toMatchObject({ success: false });
    expect((await row(item.id)).done).toBe(false);
  });

  it("no session, or an account without a cabinet id — nothing is written", async () => {
    const item = await firstOf(ann, "item");
    as(null);
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, true)).resolves.toMatchObject({ success: false });
    as((await prisma.user.findFirstOrThrow({ where: { cabinetUserId: null } })).id);
    await expect(setStudentPlanItemNote(mentorEntry, 1001, item.id, "x")).resolves.toMatchObject({ success: false });
    expect(await row(item.id)).toMatchObject({ done: false, note: null });
  });

  it("bad input — refused: a non-boolean tick, a note over the limit, a bad entry or student id", async () => {
    const item = await firstOf(ann, "item");
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, "yes")).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemNote(mentorEntry, 1001, item.id, "я".repeat(PLAN_NOTE_MAX + 1))).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemDone({ kind: "x" }, 1001, item.id, true)).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemDone(mentorEntry, "1001", item.id, true)).resolves.toMatchObject({ success: false });
    expect(await row(item.id)).toMatchObject({ done: false, note: null });
  });

  it("the plans switch off — refused", async () => {
    const item = await firstOf(ann, "item");
    await setSwitch(false);
    await expect(setStudentPlanItemDone(mentorEntry, 1001, item.id, true)).resolves.toMatchObject({ success: false });
    await expect(setStudentPlanItemNote(mentorEntry, 1001, item.id, "x")).resolves.toMatchObject({ success: false });
    expect((await row(item.id)).done).toBe(false);
  });
});
