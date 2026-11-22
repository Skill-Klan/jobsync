// @vitest-environment node
// Requirement — review of PRs #76–#95 (SKD-69), on top of the owner's rule of
// 2026-11-21 (SKD-59): the admin's correction reaches everybody's records.
//   · a correction of a value many people have is a handful of queries per
//     person, not one per job — it has to finish inside its transaction;
//   · the admin always gets an answer: two adds of one name, or a database that
//     fails, are a message, not a crashed action;
//   · a student's new value and the admin's request for it are saved together
//     or not at all;
//   · what a correction must move is read from the schema: the five lists and
//     everything that points at them are named here by hand.
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, user: { id: "u1" } as { id: string } | null, queries: [] as string[] };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({
    datasources: { db: { url: ctx.url } },
    log: [{ emit: "event", level: "query" }],
  });
  (client as unknown as { $on: (e: string, cb: (q: { query: string }) => void) => void }).$on("query", (q) =>
    ctx.queries.push(q.query),
  );
  return { default: client };
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
} from "@/actions/catalog.actions";
import { references } from "@/skillklan/catalog/catalog";

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
  vi.restoreAllMocks();
  await prisma.catalogRequest.deleteMany();
  await prisma.catalogEntry.deleteMany();
  await prisma.job.deleteMany();
  await prisma.question.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.company.deleteMany();
  await prisma.jobTitle.deleteMany();
});

describe("a correction of a skill many jobs have", () => {
  it("moves every job to the right skill, in a few queries — not one per job", async () => {
    const JOBS = 150;
    const typo = await createCatalogValue("skill", "Postgress");
    if (!typo.success) throw new Error("setup");
    const company = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u1" } });
    const title = await prisma.jobTitle.create({ data: { label: "QA", value: "qa", createdBy: "u1" } });
    for (let i = 0; i < JOBS; i++) {
      await prisma.job.create({
        data: {
          userId: "u1", description: "d", jobType: "FT", createdAt: new Date(), statusId,
          companyId: company.id, jobTitleId: title.id, tags: { connect: { id: typo.data.id } },
        },
      });
    }
    const [request] = await prisma.catalogRequest.findMany();

    ctx.queries.length = 0;
    expect(await approveCatalogItemRequest(request.id, "PostgreSQL")).toMatchObject({ success: true });
    const used = ctx.queries.length;

    const right = await prisma.tag.findFirstOrThrow({ where: { createdBy: "u1", value: "postgresql" } });
    expect(await prisma.tag.findUnique({ where: { id: typo.data.id } })).toBeNull();
    expect(await prisma.job.count({ where: { tags: { some: { id: right.id } } } })).toBe(JOBS);
    // One update per job would be 150 and more; the batch is a small constant.
    expect(used).toBeLessThan(60);
  });
});

describe("the admin always gets an answer", () => {
  it("two adds of one name: the second is «already there», not a crash", async () => {
    expect(await addCatalogItem("skill", "PostgreSQL")).toMatchObject({ success: true });
    // the second add passed the existence check before the first one saved
    vi.spyOn(appPrisma.catalogEntry, "findUnique").mockResolvedValueOnce(null);
    const second = await addCatalogItem("skill", "PostgreSQL");
    expect(second).toMatchObject({ success: false, message: expect.stringContaining("already") });
    expect(await prisma.catalogEntry.count()).toBe(1);
  });

  it("a database that fails is a message, and nothing is saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(appPrisma.catalogEntry, "create").mockRejectedValueOnce(new Error("database is locked"));
    expect(await addCatalogItem("skill", "Docker")).toMatchObject({ success: false, message: expect.any(String) });
    expect(await prisma.catalogEntry.count()).toBe(0);
    // the same call works once the database does
    expect(await addCatalogItem("skill", "Docker")).toMatchObject({ success: true });
  });
});

describe("a student's new value and the admin's request go together", () => {
  it("when the request cannot be saved the value is not saved either", async () => {
    const real = appPrisma.$transaction.bind(appPrisma) as (fn: (tx: unknown) => Promise<unknown>, o?: unknown) => Promise<unknown>;
    vi.spyOn(appPrisma, "$transaction").mockImplementation(((fn: (tx: any) => Promise<unknown>, o?: unknown) =>
      real(
        (tx: any) =>
          fn(
            new Proxy(tx, {
              get: (target, key) =>
                key === "catalogRequest"
                  ? { upsert: async () => { throw new Error("database is locked"); }, updateMany: target.catalogRequest.updateMany }
                  : target[key],
            }),
          ),
        o,
      )) as never);
    await expect(createCatalogValue("skill", "Postgress")).rejects.toThrow("database is locked");
    expect(await prisma.tag.count({ where: { createdBy: "u1" } })).toBe(0);
    expect(await prisma.catalogRequest.count()).toBe(0);
  });

  it("paired: when both can be saved, the value and the request both exist", async () => {
    expect(await createCatalogValue("skill", "Postgress")).toMatchObject({ success: true });
    expect(await prisma.tag.count({ where: { createdBy: "u1", value: "postgress" } })).toBe(1);
    expect(await prisma.catalogRequest.count({ where: { requestedBy: "u1", status: "pending" } })).toBe(1);
  });
});

describe("what a correction moves, by model", () => {
  const sorted = <T extends object>(list: T[]) => list.map((x) => JSON.stringify(x)).sort();

  it.each([
    ["Tag", [{ model: "Skill", field: "tagId" }], [{ model: "Job", field: "tags", back: "jobs" }, { model: "Question", field: "tags", back: "questions" }]],
    ["Company", [{ model: "WorkExperience", field: "companyId" }, { model: "Contact", field: "companyId" }, { model: "Contact", field: "workedAtCompanyId" }, { model: "Job", field: "companyId" }], []],
    ["JobTitle", [{ model: "WorkExperience", field: "jobTitleId" }, { model: "Job", field: "jobTitleId" }], []],
    ["Location", [{ model: "WorkExperience", field: "locationId" }, { model: "Education", field: "locationId" }, { model: "Contact", field: "locationId" }, { model: "Job", field: "locationId" }], []],
    ["JobSource", [{ model: "Job", field: "jobSourceId" }], []],
  ])("%s", (model, keys, links) => {
    const found = references(model);
    expect(sorted(found.keys)).toEqual(sorted(keys));
    expect(sorted(found.links)).toEqual(sorted(links));
  });

  it("is read once: the same answer object comes back", () => {
    expect(references("Tag")).toBe(references("Tag"));
  });
});
