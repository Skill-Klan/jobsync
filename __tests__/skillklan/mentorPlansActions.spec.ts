// @vitest-environment node
// Requirement — docs/contracts/study-plans-mentors.md, D89–D93, D98:
//   · a viewer looks at a student's plan only if the BACKEND's list for the
//     chosen entry (a mentor, or «Без ментора») has that student — the list is
//     asked again at that moment, so a changed id opens nobody else's plan;
//   · the viewer is the signed-in person (never an id from the browser); no
//     session, or an account with no cabinet id, sees nothing;
//   · fail closed: a list that could not be loaded gives a notice and no plan;
//   · view only: nothing here writes;
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
}));

import { getEntryStudents, getStudentPlans } from "@/actions/plan.actions";
import { assignPlan } from "@/skillklan/plans/assignPlan";
import { ACCESS_SHARE_MS } from "@/skillklan/accessRecheck";

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
      data: { name: "Ще не входив", hasAccount: false, plans: [] },
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
