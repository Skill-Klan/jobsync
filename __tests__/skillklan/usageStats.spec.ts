// @vitest-environment node
// Requirement — the owner, 2026-11-22 (SKD-66, level 1): the admin wants to see
// who signs in and what people do in SkillKlan Job. "Level 1" = counted from
// what the app already stores; "only the admin sees it".
//   · people = accounts that came from the cabinet (a dev-only password account
//     is not a person of the school);
//   · "signed in" = has lastLoginAt; active in 7 / 30 days = signed in that recently;
//   · per person: vacancies, resumes (and with a file), study-plan points ticked —
//     each person's own, never summed across (the owner dropped applied ones, tasks
//     and interview stages: tasks are switched off, the others add nothing);
//   · the summary counts people who have at least one of each; the median of
//     vacancies is over everyone, those with none included;
//   · the list starts with the longest quiet: never signed in, then the oldest sign-in;
//   · a student, a mentor, no session at all → nothing (null).
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, admin: true };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/skillklan/cabinetAdmin", () => ({ isAdminSession: vi.fn(async () => ctx.admin) }));

import appPrisma from "@/lib/db";
import { getUsageStats } from "@/actions/usageStats.actions";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
const NOW = new Date("2026-11-22T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

let statusId = "";
let companyId = "";
let titleId = "";

async function person(id: string, name: string, cabinetUserId: number | null, lastLoginAt: Date | null) {
  return prisma.user.create({
    data: { id, name, email: `${id}@test.invalid`, password: "-", cabinetUserId, lastLoginAt },
  });
}
async function job(userId: string) {
  return prisma.job.create({
    data: { userId, description: "d", jobType: "FT", createdAt: NOW, statusId, companyId, jobTitleId: titleId },
  });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  statusId = (await prisma.jobStatus.create({ data: { label: "Applied", value: "applied" } })).id;
  const owner = await person("owner", "Owner", 9000, null);
  companyId = (await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: owner.id } })).id;
  titleId = (await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: owner.id } })).id;
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

beforeEach(async () => {
  ctx.admin = true;
  await prisma.planItem.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.job.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.file.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany({ where: { id: { not: "owner" } } });
  await prisma.user.update({ where: { id: "owner" }, data: { cabinetUserId: null } });
});

describe("who is counted", () => {
  it("only people from the cabinet; a dev-only password account is not one", async () => {
    await person("a", "Anna", 1, daysAgo(1));
    await person("dev", "Dev only", null, daysAgo(1));

    const stats = await getUsageStats();

    expect(stats?.people.map((p) => p.name)).toEqual(["Anna"]);
    expect(stats?.summary.people).toBe(1);
  });
});

describe("signing in", () => {
  it("never / active in 7 days / active in 30 days / older — each counted once", async () => {
    await person("n", "Never", 1, null);
    await person("d3", "Three days", 2, daysAgo(3));
    await person("d20", "Twenty days", 3, daysAgo(20));
    await person("d60", "Sixty days", 4, daysAgo(60));

    const { summary } = (await getUsageStats())!;

    expect(summary).toMatchObject({ people: 4, signedIn: 3, neverSignedIn: 1, active7: 1, active30: 2 });
  });

  it("the window edge: exactly 7 days ago is still active, a minute earlier is not", async () => {
    await person("edge", "Edge", 1, daysAgo(7));
    await person("out", "Out", 2, new Date(daysAgo(7).getTime() - 60_000));

    const { summary } = (await getUsageStats())!;

    expect(summary.active7).toBe(1);
  });

  it("the list starts with the longest quiet: never, then the oldest sign-in", async () => {
    await person("r", "Recent", 1, daysAgo(1));
    await person("o", "Old", 2, daysAgo(40));
    await person("n", "Never", 3, null);

    const { people } = (await getUsageStats())!;

    expect(people.map((p) => p.name)).toEqual(["Never", "Old", "Recent"]);
  });
});

describe("what a person has made", () => {
  it("counts each person's own vacancies, resumes, files and ticked plan points", async () => {
    const a = await person("a", "Anna", 1, daysAgo(1));
    const b = await person("b", "Boris", 2, daysAgo(2));

    // Anna: 3 vacancies, 2 resumes (1 with a file), 2 ticked points (a third is not ticked).
    for (let i = 0; i < 3; i++) await job(a.id);
    const profile = await prisma.profile.create({ data: { userId: a.id } });
    const file = await prisma.file.create({ data: { fileName: "cv.pdf", fileType: "pdf", filePath: "data/files/resumes/cv.pdf" } });
    await prisma.resume.create({ data: { profileId: profile.id, title: "With file", FileId: file.id } });
    await prisma.resume.create({ data: { profileId: profile.id, title: "Without" } });
    const plan = await prisma.plan.create({ data: { userId: a.id, track: "java", title: "Java" } });
    await prisma.planItem.createMany({
      data: [
        { planId: plan.id, kind: "item", title: "x", position: 0, done: true },
        { planId: plan.id, kind: "item", title: "y", position: 1, done: true },
        { planId: plan.id, kind: "item", title: "z", position: 2, done: false },
      ],
    });
    // Boris: one vacancy, nothing else.
    await job(b.id);

    const { people } = (await getUsageStats())!;
    const anna = people.find((p) => p.name === "Anna")!;
    const boris = people.find((p) => p.name === "Boris")!;

    expect(anna).toMatchObject({ jobs: 3, resumes: 2, resumesWithFile: 1, planDone: 2 });
    expect(boris).toMatchObject({ jobs: 1, resumes: 0, resumesWithFile: 0, planDone: 0 });
  });

  it("the summary counts people who have at least one; the median of vacancies is over everyone", async () => {
    const a = await person("a", "Anna", 1, daysAgo(1));
    const b = await person("b", "Boris", 2, daysAgo(2));
    await person("c", "Clara", 3, null);
    await person("d", "Dmytro", 4, null);
    for (let i = 0; i < 5; i++) await job(a.id);
    await job(b.id);
    const profile = await prisma.profile.create({ data: { userId: a.id } });
    await prisma.resume.create({ data: { profileId: profile.id, title: "R" } });

    const { summary } = (await getUsageStats())!;

    // vacancies per person: 5, 1, 0, 0 → median (0 + 1) / 2
    expect(summary).toMatchObject({
      people: 4,
      withJobs: 2,
      withResume: 1,
      withResumeFile: 0,
      withPlanProgress: 0,
      medianJobs: 0.5,
    });
  });
});

describe("who may look", () => {
  it("not an admin (a student, a mentor, no session) → nothing at all", async () => {
    await person("a", "Anna", 1, daysAgo(1));
    ctx.admin = false;

    expect(await getUsageStats()).toBeNull();
  });

  it("the admin gets the numbers (paired case)", async () => {
    await person("a", "Anna", 1, daysAgo(1));

    expect(await getUsageStats()).not.toBeNull();
  });
});
