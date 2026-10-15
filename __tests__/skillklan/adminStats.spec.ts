// @vitest-environment node
// Requirement — the SkillKlan admin sees numbers for everyone who uses
// SkillKlan Job (owner decisions D42, D46), and only numbers:
//   · one row per person who came in from the cabinet, keyed by their cabinet
//     id; accounts with no cabinet person (dev-only password login) are not
//     rows but a separate count;
//   · nobody's data counts towards anybody else;
//   · jobs: total, marked applied, per current status; interviews — exactly
//     what the student's own Interviews page lists; resumes, cover letters,
//     automations (and how many are active), tasks, activities, contacts,
//     questions;
//   · a person who has done nothing is a row of zeros, not a missing row;
//   · first and last sign-in from the cabinet;
//   · asked for particular people — just them; someone who never came in is
//     simply absent.
// Expected numbers are counted by hand from the data seeded below; the
// interview count is also checked against the Interviews page itself (a
// different code path).
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, currentUserId: "" };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
// The Interviews page action, as the student whose page it is.
vi.mock("@/actions/shared", () => ({ requireUser: async () => ({ id: ctx.currentUserId }) }));
vi.mock("@/i18n/server", () => ({ getTranslations: async () => (key: string) => key }));

import appPrisma from "@/lib/db";
import { findOrCreateCabinetUser } from "@/skillklan/cabinetUser";
import { collectUserStats, countUnlinkedAccounts } from "@/skillklan/adminStats";
import { getInterviewList } from "@/actions/interview.actions";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

let anna: string; // cabinet 201 — busy
let bohdan: string; // cabinet 202 — came in, did nothing
let dev: string; // no cabinet id — dev-only password account

async function statusId(value: string) {
  return (await prisma.jobStatus.findUniqueOrThrow({ where: { value } })).id;
}

async function stageTypeId(userId: string, value: string) {
  return (await prisma.jobStageType.findFirstOrThrow({ where: { createdBy: userId, value } })).id;
}

async function job(userId: string, status: string, applied: boolean) {
  const title = await prisma.jobTitle.create({
    data: { label: "QA", value: `qa-${Math.random()}`, createdBy: userId },
  });
  const company = await prisma.company.create({
    data: { label: "Acme", value: `acme-${Math.random()}`, createdBy: userId },
  });
  return prisma.job.create({
    data: {
      userId,
      description: "",
      jobType: "FT",
      createdAt: new Date(),
      applied,
      statusId: await statusId(status),
      jobTitleId: title.id,
      companyId: company.id,
    },
  });
}

async function stage(jobId: string, userId: string, typeValue: string) {
  await prisma.jobStage.create({
    data: { jobId, stageTypeId: await stageTypeId(userId, typeValue), occurredAt: new Date() },
  });
}

async function busyAccount(userId: string) {
  await job(userId, "draft", false);
  await job(userId, "applied", true);
  const interviewing = await job(userId, "interview", true);
  await stage(interviewing.id, userId, "applied"); // not an interview
  await stage(interviewing.id, userId, "1st screening interview");
  await stage(interviewing.id, userId, "2nd technical interview");
  await job(userId, "offer", true);
  await job(userId, "rejected", true);

  const profile = await prisma.profile.create({ data: { userId } });
  const resume = await prisma.resume.create({ data: { profileId: profile.id, title: "CV 1" } });
  await prisma.resume.create({ data: { profileId: profile.id, title: "CV 2" } });
  await prisma.coverLetter.create({ data: { profileId: profile.id, title: "Letter", content: "…" } });

  const base = { userId, jobBoard: "greenhouse", keywords: "qa", location: "remote", resumeId: resume.id, scheduleHour: 9 };
  await prisma.automation.create({ data: { ...base, name: "On", status: "active" } });
  await prisma.automation.create({ data: { ...base, name: "Off", status: "paused" } });

  await prisma.task.createMany({ data: [1, 2, 3].map((n) => ({ userId, title: `Task ${n}` })) });
  const type = await prisma.activityType.create({ data: { label: "Search", value: `search-${userId}`, createdBy: userId } });
  await prisma.activity.create({ data: { userId, activityName: "Look", startTime: new Date(), activityTypeId: type.id } });
  await prisma.contact.createMany({ data: [{ name: "HR", createdBy: userId }, { name: "Lead", createdBy: userId }] });
  await prisma.question.create({ data: { question: "Why us?", createdBy: userId } });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T09:00:00.000Z"));
  anna = (await findOrCreateCabinetUser({ userId: 201, role: "student", name: "Anna" })).id;
  vi.setSystemTime(new Date("2026-10-12T09:00:00.000Z"));
  bohdan = (await findOrCreateCabinetUser({ userId: 202, role: "student", name: "Bohdan" })).id;
  vi.setSystemTime(new Date("2026-10-14T18:45:00.000Z"));
  await findOrCreateCabinetUser({ userId: 201, role: "student", name: "Anna" }); // came back
  vi.useRealTimers();

  // A dev-only account with plenty of data: none of it may reach anyone's row.
  const devUser = await findOrCreateCabinetUser({ userId: 299, role: "student", name: "Dev" });
  dev = devUser.id;
  await prisma.user.update({ where: { id: dev }, data: { cabinetUserId: null } });

  await busyAccount(anna);
  await busyAccount(dev);
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe("collectUserStats — everyone", () => {
  it("one row per cabinet person, by cabinet id; the dev-only account is not a row", async () => {
    const rows = await collectUserStats();
    expect(rows.map((r) => r.cabinetUserId)).toEqual([201, 202]);
  });

  it("the busy account — counted by hand from what was seeded", async () => {
    const [row] = (await collectUserStats()).filter((r) => r.cabinetUserId === 201);
    expect(row).toEqual({
      cabinetUserId: 201,
      firstLoginAt: expect.any(String),
      lastLoginAt: "2026-10-14T18:45:00.000Z",
      jobs: {
        total: 5,
        applied: 4,
        byStatus: { draft: 1, applied: 1, interview: 1, offer: 1, rejected: 1 },
      },
      interviews: 2,
      resumes: 2,
      coverLetters: 1,
      automations: { total: 2, active: 1 },
      tasks: 3,
      activities: 1,
      contacts: 2,
      questions: 1,
    });
  });

  it("the account that came in and did nothing — a row of zeros", async () => {
    const [row] = (await collectUserStats()).filter((r) => r.cabinetUserId === 202);
    expect(row).toEqual({
      cabinetUserId: 202,
      firstLoginAt: expect.any(String),
      lastLoginAt: "2026-10-12T09:00:00.000Z",
      jobs: { total: 0, applied: 0, byStatus: {} },
      interviews: 0,
      resumes: 0,
      coverLetters: 0,
      automations: { total: 0, active: 0 },
      tasks: 0,
      activities: 0,
      contacts: 0,
      questions: 0,
    });
  });

  it("interviews — the same number the student's own Interviews page shows", async () => {
    ctx.currentUserId = anna;
    const page = await getInterviewList(1, 100);
    const [row] = (await collectUserStats()).filter((r) => r.cabinetUserId === 201);
    expect(page.total).toBe(2);
    expect(row.interviews).toBe(page.total);
  });

  it("first sign-in is the account's creation, last — the latest sign-in", async () => {
    const [row] = (await collectUserStats()).filter((r) => r.cabinetUserId === 201);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: anna } });
    expect(row.firstLoginAt).toBe(stored.createdAt.toISOString());
    expect(row.lastLoginAt).not.toBe(row.firstLoginAt);
  });

  it("accounts with no cabinet person are counted, not listed", async () => {
    expect(await countUnlinkedAccounts()).toBe(1);
  });
});

describe("collectUserStats — particular people", () => {
  it("just the people asked for", async () => {
    const rows = await collectUserStats([202]);
    expect(rows.map((r) => r.cabinetUserId)).toEqual([202]);
    expect(rows[0].jobs.total).toBe(0);
  });

  it("someone who never came in is absent, not an error", async () => {
    await expect(collectUserStats([999])).resolves.toEqual([]);
  });

  it("asking for one person gives the same numbers as the full list", async () => {
    const [one] = await collectUserStats([201]);
    const [fromAll] = (await collectUserStats()).filter((r) => r.cabinetUserId === 201);
    expect(one).toEqual(fromAll);
  });
});
