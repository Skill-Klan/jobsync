// @vitest-environment node
// Requirement — the owner, 2026-11-21 (SKD-59): "I correct it, it updates in
// the student's record, and that is all". When the admin corrects or replaces a
// value a student created (Raifeisen Bank → Raiffeisen Bank), everything that
// pointed at the misspelt row — jobs, work records, contacts, a skill on jobs
// and questions — points at the right one afterwards, for every student who had
// it, and the old row is gone. Each student keeps their own rows (no sharing
// between people); what the old row knew and the target did not is kept.
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, user: { id: "u1" } as { id: string } | null };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/skillklan/featureFlags", () => ({ isFeatureOff: vi.fn(async () => false) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({
  confirmCabinetAdmin: vi.fn(async () => 4242),
  isAdminSession: vi.fn(async () => true),
}));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn(async () => ctx.user) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import appPrisma from "@/lib/db";
import {
  addCatalogItem,
  approveCatalogItemRequest,
  createCatalogValue,
  replaceCatalogItemRequest,
} from "@/actions/catalog.actions";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

let statusId = "";

beforeAll(async () => {
  for (const id of ["u1", "u2"]) {
    await prisma.user.create({ data: { id, name: `Student ${id}`, email: `${id}@test.invalid`, password: "-" } });
  }
  statusId = (await prisma.jobStatus.create({ data: { label: "Applied", value: "applied" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

beforeEach(async () => {
  ctx.user = { id: "u1" };
  await prisma.catalogRequest.deleteMany();
  await prisma.catalogEntry.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.workExperience.deleteMany();
  await prisma.job.deleteMany();
  await prisma.question.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.company.deleteMany();
  await prisma.jobTitle.deleteMany();
  await prisma.location.deleteMany();
});

const asUser = (id: string) => {
  ctx.user = { id };
};

// A job of a student, by the rows they have.
async function makeJob(userId: string, companyId: string, jobTitleId: string, extra: Record<string, unknown> = {}) {
  return prisma.job.create({
    data: { userId, description: "d", jobType: "FT", createdAt: new Date(), statusId, companyId, jobTitleId, ...extra },
  });
}

describe("correcting a company a student made", () => {
  it("moves the jobs, work records and contacts of every student who had the wrong spelling", async () => {
    // Two students, the same typo, each with their own rows and records.
    const records: Record<string, { jobId: string; experienceId: string; contactId: string; workedAtId: string }> = {};
    for (const id of ["u1", "u2"]) {
      asUser(id);
      const made = await createCatalogValue("company", "Raifeisen Bank");
      if (!made.success) throw new Error("setup");
      const title = await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: id } });
      const place = await prisma.location.create({ data: { label: "Kyiv", value: "kyiv", createdBy: id } });
      const job = await makeJob(id, made.data.id, title.id);
      const experience = await prisma.workExperience.create({
        data: { companyId: made.data.id, jobTitleId: title.id, locationId: place.id, startDate: new Date(), description: "d" },
      });
      const contact = await prisma.contact.create({
        data: { name: "Ann", createdBy: id, companyId: made.data.id, workedAtCompanyId: made.data.id },
      });
      records[id] = { jobId: job.id, experienceId: experience.id, contactId: contact.id, workedAtId: made.data.id };
    }
    const [request] = await prisma.catalogRequest.findMany({ where: { requestedBy: "u1" } });

    asUser("u1");
    const result = await approveCatalogItemRequest(request.id, "Raiffeisen Bank");
    expect(result).toMatchObject({ success: true, data: { value: "raiffeisen bank" } });

    for (const id of ["u1", "u2"]) {
      const rows = await prisma.company.findMany({ where: { createdBy: id } });
      // one row each, under the right key and name — the old row is gone
      expect(rows.map((r) => [r.label, r.value])).toEqual([["Raiffeisen Bank", "raiffeisen bank"]]);
      const [row] = rows;
      expect((await prisma.job.findUniqueOrThrow({ where: { id: records[id].jobId } })).companyId).toBe(row.id);
      expect((await prisma.workExperience.findUniqueOrThrow({ where: { id: records[id].experienceId } })).companyId).toBe(row.id);
      expect(await prisma.contact.findUniqueOrThrow({ where: { id: records[id].contactId } })).toMatchObject({
        companyId: row.id,
        workedAtCompanyId: row.id,
      });
    }
    // two people, two rows: nothing is shared between them
    expect(await prisma.company.count()).toBe(2);
  });

  it("a student who already has the right row gets their records moved onto it, and what the old row knew is kept", async () => {
    await addCatalogItem("company", "Raiffeisen Bank");
    asUser("u1");
    const right = await prisma.company.create({ data: { label: "Raiffeisen Bank", value: "raiffeisen bank", createdBy: "u1" } });
    const typo = await createCatalogValue("company", "Raifeisen Bank");
    if (!typo.success) throw new Error("setup");
    await prisma.company.update({ where: { id: typo.data.id }, data: { logoUrl: "https://logo.test/r.png", watched: true } });
    const title = await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: "u1" } });
    const job = await makeJob("u1", typo.data.id, title.id);
    const [request] = await prisma.catalogRequest.findMany();

    const entry = await prisma.catalogEntry.findFirstOrThrow();
    expect(await replaceCatalogItemRequest(request.id, entry.id)).toMatchObject({ success: true });

    expect(await prisma.company.findMany({ where: { createdBy: "u1" } })).toMatchObject([
      { id: right.id, label: "Raiffeisen Bank", logoUrl: "https://logo.test/r.png", watched: true },
    ]);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).companyId).toBe(right.id);
  });

  it("another student's own rows under other keys are not touched", async () => {
    asUser("u1");
    const typo = await createCatalogValue("company", "Raifeisen Bank");
    if (!typo.success) throw new Error("setup");
    asUser("u2");
    const other = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u2" } });
    const [request] = await prisma.catalogRequest.findMany();

    expect(await approveCatalogItemRequest(request.id, "Raiffeisen Bank")).toMatchObject({ success: true });

    expect(await prisma.company.findUnique({ where: { id: other.id } })).toMatchObject({ label: "Acme", createdBy: "u2" });
    expect(await prisma.company.count({ where: { createdBy: "u2" } })).toBe(1);
  });
});

describe("a skill and a title", () => {
  it("replacing a skill moves it on jobs and on questions (many-to-many), and the old tag goes", async () => {
    const entry = await addCatalogItem("skill", "PostgreSQL");
    if (!entry.success) throw new Error("setup");
    asUser("u1");
    const typo = await createCatalogValue("skill", "Postgress");
    if (!typo.success) throw new Error("setup");
    const keep = await prisma.tag.create({ data: { label: "Docker", value: "docker", createdBy: "u1" } });
    const company = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u1" } });
    const title = await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: "u1" } });
    const job = await makeJob("u1", company.id, title.id, { tags: { connect: [{ id: typo.data.id }, { id: keep.id }] } });
    const question = await prisma.question.create({
      data: { question: "q?", createdBy: "u1", tags: { connect: { id: typo.data.id } } },
    });
    const [request] = await prisma.catalogRequest.findMany();

    expect(await replaceCatalogItemRequest(request.id, entry.data.id)).toMatchObject({ success: true });

    const right = await prisma.tag.findFirstOrThrow({ where: { createdBy: "u1", value: "postgresql" } });
    expect(await prisma.tag.findUnique({ where: { id: typo.data.id } })).toBeNull();
    const jobTags = (await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: { tags: true } })).tags.map((t) => t.id).sort();
    expect(jobTags).toEqual([keep.id, right.id].sort());
    const questionTags = (await prisma.question.findUniqueOrThrow({ where: { id: question.id }, include: { tags: true } })).tags;
    expect(questionTags.map((t) => t.id)).toEqual([right.id]);
  });

  it("a job that has both the typo and the right skill ends with the right one once", async () => {
    const entry = await addCatalogItem("skill", "PostgreSQL");
    if (!entry.success) throw new Error("setup");
    asUser("u1");
    const right = await prisma.tag.create({ data: { label: "PostgreSQL", value: "postgresql", createdBy: "u1" } });
    const typo = await createCatalogValue("skill", "Postgress");
    if (!typo.success) throw new Error("setup");
    const company = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u1" } });
    const title = await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: "u1" } });
    const job = await makeJob("u1", company.id, title.id, { tags: { connect: [{ id: typo.data.id }, { id: right.id }] } });
    const [request] = await prisma.catalogRequest.findMany();

    expect(await replaceCatalogItemRequest(request.id, entry.data.id)).toMatchObject({ success: true });

    const tags = (await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: { tags: true } })).tags;
    expect(tags.map((t) => t.id)).toEqual([right.id]);
  });

  it("a job title typed with a typo is replaced on the jobs and work records", async () => {
    const entry = await addCatalogItem("jobTitle", "QA Engineer");
    if (!entry.success) throw new Error("setup");
    asUser("u1");
    const typo = await createCatalogValue("jobTitle", "QA Enginer");
    if (!typo.success) throw new Error("setup");
    const company = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u1" } });
    const place = await prisma.location.create({ data: { label: "Kyiv", value: "kyiv", createdBy: "u1" } });
    const job = await makeJob("u1", company.id, typo.data.id);
    const experience = await prisma.workExperience.create({
      data: { companyId: company.id, jobTitleId: typo.data.id, locationId: place.id, startDate: new Date(), description: "d" },
    });
    const [request] = await prisma.catalogRequest.findMany();

    expect(await replaceCatalogItemRequest(request.id, entry.data.id)).toMatchObject({ success: true });

    const right = await prisma.jobTitle.findFirstOrThrow({ where: { createdBy: "u1", value: "qa engineer" } });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).jobTitleId).toBe(right.id);
    expect((await prisma.workExperience.findUniqueOrThrow({ where: { id: experience.id } })).jobTitleId).toBe(right.id);
    expect(await prisma.jobTitle.findUnique({ where: { id: typo.data.id } })).toBeNull();
  });
});
