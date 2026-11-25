// @vitest-environment node
// Requirement — SKD-62 (owner, 2026-11-25): a mentor, the QA moderator and the
// admin see how many jobs a student applied for today, in the last 7 days and in
// the last 30 days, next to the student's plan on «Навчальний план». Only the
// count of applications is shown — view only, nothing is written, and no
// backend journal (the owner's choice).
//   · the windows are the dashboard's own: local days, today included, so «7 days»
//     is today and the six days before it, «30 days» today and the 29 before;
//   · only jobs marked as applied count, by the date of the application;
//   · only that student's jobs — never the viewer's or another student's;
//   · a student is opened only if the BACKEND's list for the entry holds them
//     (docs/contracts/study-plans-mentors.md): a student not on the list gets no
//     counts, and a student who never signed in has no jobs here — `null`, not zeros;
//   · the plans switch off → refused, like the plan itself.
// Real SQLite with the current schema; the backend is a fake.
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, session: { value: null as null | { user: { id: string } } }, students: vi.fn() };
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
}));

import { getStudentPlans } from "@/actions/plan.actions";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
const entry = { kind: "mentor", mentorId: 1004 };

// «Now» is 25 November 2026, 15:00 local.
const at = (daysAgo: number, hour = 12) => new Date(2026, 10, 25 - daysAgo, hour, 0, 0);

let viewer: string;
let ann: string;
let bob: string;
let refs: { statusId: string; jobTitleId: string; companyId: string };

const makeUser = (name: string, cabinetUserId: number | null) =>
  prisma.user.create({
    data: { name, email: `u-${name}-${cabinetUserId}@users.invalid`, password: "-", cabinetUserId },
  });

const job = (userId: string, extra: { applied: boolean; appliedDate: Date | null }) =>
  prisma.job.create({
    data: { userId, description: "d", jobType: "FT", createdAt: at(40), ...refs, ...extra },
  });

beforeAll(async () => {
  viewer = (await makeUser("Viewer", 42)).id;
  ann = (await makeUser("Анна", 1001)).id;
  bob = (await makeUser("Богдан", 1002)).id;
  refs = {
    statusId: (await prisma.jobStatus.create({ data: { label: "New", value: "new" } })).id,
    jobTitleId: (await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: viewer } })).id,
    companyId: (await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: viewer } })).id,
  };
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(0, 15));
  (globalThis as { skillklanSharedMentorLists?: Map<string, unknown> }).skillklanSharedMentorLists?.clear();
  await prisma.job.deleteMany();
  await prisma.featureToggle.deleteMany();
  await prisma.featureToggle.create({ data: { key: "plans", enabled: true } });
  ctx.students.mockReset().mockResolvedValue([{ userId: 1001, name: "Анна" }]);
  ctx.session.value = { user: { id: viewer } };
});

afterEach(() => vi.useRealTimers());
afterAll(async () => {
  await prisma.$disconnect();
});

const counts = async (studentId: unknown = 1001) => {
  const result = await getStudentPlans(entry, studentId);
  if (!result.success) throw new Error(result.message);
  return result.data.applications;
};

describe("the student's applications", () => {
  it("today, 7 and 30 days — today included — by the date of the application", async () => {
    await job(ann, { applied: true, appliedDate: at(0, 9) }); // today
    await job(ann, { applied: true, appliedDate: at(6) }); // the 7th day: still in 7
    await job(ann, { applied: true, appliedDate: at(7) }); // out of 7, in 30
    await job(ann, { applied: true, appliedDate: at(29) }); // the 30th day: in 30
    await job(ann, { applied: true, appliedDate: at(30) }); // out
    await job(ann, { applied: true, appliedDate: at(-1) }); // tomorrow: not yet
    expect(await counts()).toEqual({ today: 1, last7: 2, last30: 4 });
  });

  it("a saved job that is not applied for does not count, whatever its date", async () => {
    await job(ann, { applied: false, appliedDate: at(0) });
    await job(ann, { applied: false, appliedDate: null });
    await job(ann, { applied: true, appliedDate: null });
    expect(await counts()).toEqual({ today: 0, last7: 0, last30: 0 });
  });

  it("only this student's jobs — not the viewer's, not another student's", async () => {
    await job(ann, { applied: true, appliedDate: at(0) });
    await job(bob, { applied: true, appliedDate: at(0) });
    await job(viewer, { applied: true, appliedDate: at(0) });
    expect(await counts()).toEqual({ today: 1, last7: 1, last30: 1 });
  });

  it("a student the backend's list does not hold gets no counts at all", async () => {
    await job(bob, { applied: true, appliedDate: at(0) });
    expect((await getStudentPlans(entry, 1002)).success).toBe(false); // not on this mentor's list
    expect((await getStudentPlans(entry, 999999)).success).toBe(false);
  });

  it("a student who never signed in has no jobs here: null, not zeros", async () => {
    ctx.students.mockResolvedValue([{ userId: 7777, name: "Ще не входив" }]);
    expect(await counts(7777)).toBeNull();
  });

  it("reading writes nothing", async () => {
    await job(ann, { applied: true, appliedDate: at(0) });
    const before = await prisma.job.findMany({ orderBy: { id: "asc" } });
    await counts();
    expect(await prisma.job.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });

  it("the plans switch off → refused, and on, the same call answers", async () => {
    await prisma.featureToggle.update({ where: { key: "plans" }, data: { enabled: false } });
    expect((await getStudentPlans(entry, 1001)).success).toBe(false);
    await prisma.featureToggle.update({ where: { key: "plans" }, data: { enabled: true } });
    expect((await getStudentPlans(entry, 1001)).success).toBe(true);
  });
});
