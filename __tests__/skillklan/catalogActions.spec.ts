// @vitest-environment node
// Requirement — product notes, 2026-11-03: the shared catalog.
//   · only whoever manages SkillKlan Job changes it (the backend is asked now);
//     a student can only create their own value and pick what is there;
//   · with the switch `catalog` off every action refuses and writes nothing;
//   · a rename changes the name for everybody — their own rows that share the
//     key get it too — and the key stays; taking an entry out only takes it out
//     of the pickers, jobs that have it keep it;
//   · owner 2026-11-21 (SKD-59): a student who lacks a value creates it and has
//     it at once; the admin gets a copy (one request per person and value), can
//     correct the spelling or replace it with an existing entry — everybody's
//     rows under the misspelt key move to it — or leave it as it is;
//   · picking an entry makes the person's own row once, with the catalog's key
//     and name; two people get two rows.
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return {
    url,
    dir,
    on: true,
    admin: 4242 as number | null,
    adminSession: true,
    user: { id: "u1" } as { id: string } | null,
    revalidate: vi.fn(),
  };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/skillklan/featureFlags", () => ({ isFeatureOff: vi.fn(async () => !ctx.on) }));
vi.mock("@/skillklan/cabinetAdmin", () => ({
  confirmCabinetAdmin: vi.fn(async () => ctx.admin),
  isAdminSession: vi.fn(async () => ctx.adminSession),
}));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn(async () => ctx.user) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => ctx.revalidate(...args) }));

import appPrisma from "@/lib/db";
import {
  addCatalogItem,
  approveCatalogItemRequest,
  getCatalogAdminData,
  pickCatalogItem,
  rejectCatalogItemRequest,
  removeCatalogItem,
  renameCatalogItem,
  createCatalogValue,
  replaceCatalogItemRequest,
} from "@/actions/catalog.actions";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

const OFF_MESSAGE = "The catalog is switched off. Reload the page.";
const ADMIN_ONLY = "Only the administrator and the QA moderator can change the catalog.";

beforeAll(async () => {
  for (const id of ["u1", "u2"]) {
    await prisma.user.create({ data: { id, name: `Student ${id}`, email: `${id}@test.invalid`, password: "-" } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

beforeEach(async () => {
  ctx.on = true;
  ctx.admin = 4242;
  ctx.adminSession = true;
  ctx.user = { id: "u1" };
  ctx.revalidate.mockClear();
  await prisma.catalogRequest.deleteMany();
  await prisma.catalogEntry.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.company.deleteMany();
});

const entries = () => prisma.catalogEntry.findMany({ orderBy: { value: "asc" } });
const state = async () => JSON.stringify([await entries(), await prisma.catalogRequest.findMany(), await prisma.tag.findMany()]);

describe("the admin changes the catalog", () => {
  it("adds an entry — trimmed, keyed, stored with who added it, menus re-render", async () => {
    const result = await addCatalogItem("skill", "  Test   Cases ");
    expect(result).toMatchObject({ success: true, data: { kind: "skill", label: "Test Cases", value: "test cases" } });
    expect(await entries()).toMatchObject([{ kind: "skill", label: "Test Cases", value: "test cases", createdByCabinetUserId: 4242 }]);
    expect(ctx.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("the same name twice, a bad name and an unknown list are refused and write nothing", async () => {
    await addCatalogItem("skill", "Java");
    const before = await state();
    expect(await addCatalogItem("skill", "java")).toEqual({ success: false, message: "This is already in the catalog." });
    expect(await addCatalogItem("skill", "x")).toEqual({ success: false, message: "A name needs 2 to 80 characters." });
    expect(await addCatalogItem("contact", "Java")).toEqual({ success: false, message: "There is no such list." });
    expect(await state()).toBe(before);
    // the same name in another list is another entry
    expect(await addCatalogItem("jobTitle", "Java")).toMatchObject({ success: true });
  });

  it("renames for everybody: the name changes, the key stays, own rows that share it follow", async () => {
    const added = await addCatalogItem("skill", "Postman");
    if (!added.success) throw new Error("setup");
    for (const id of ["u1", "u2"]) await prisma.tag.create({ data: { label: "postman", value: "postman", createdBy: id } });
    await prisma.tag.create({ data: { label: "Selenium", value: "selenium", createdBy: "u1" } });

    expect(await renameCatalogItem(added.data.id, "Postman (API)")).toMatchObject({
      success: true,
      data: { label: "Postman (API)", value: "postman" },
    });

    expect((await entries())[0]).toMatchObject({ label: "Postman (API)", value: "postman" });
    expect((await prisma.tag.findMany({ where: { value: "postman" } })).map((t) => t.label)).toEqual(["Postman (API)", "Postman (API)"]);
    expect((await prisma.tag.findFirst({ where: { value: "selenium" } }))?.label).toBe("Selenium");
  });

  it("a rename to a name another entry has is refused", async () => {
    await addCatalogItem("skill", "Java");
    const python = await addCatalogItem("skill", "Python");
    if (!python.success) throw new Error("setup");
    expect(await renameCatalogItem(python.data.id, "JAVA")).toEqual({ success: false, message: "This is already in the catalog." });
    expect((await entries()).map((e) => e.label)).toEqual(["Java", "Python"]);
  });

  it("taking an entry out only takes it out of the list: the person's own rows stay", async () => {
    const added = await addCatalogItem("company", "Acme");
    if (!added.success) throw new Error("setup");
    const row = await prisma.company.create({ data: { label: "Acme", value: "acme", createdBy: "u1" } });

    expect(await removeCatalogItem(added.data.id)).toEqual({ success: true });

    expect(await entries()).toEqual([]);
    expect(await prisma.company.findUnique({ where: { id: row.id } })).not.toBeNull();
    expect(await removeCatalogItem(added.data.id)).toEqual({
      success: false,
      message: "Not found. It may have been changed already — reload the page.",
    });
  });
});

describe("a student's new value", () => {
  it("is theirs at once, and the admin gets one copy however often it is created", async () => {
    const first = await createCatalogValue("skill", "Rust");
    const second = await createCatalogValue("skill", " rust ");
    expect(first).toMatchObject({ success: true, data: { label: "Rust", value: "rust" } });
    expect(second).toEqual(first);
    expect(await prisma.tag.findMany({ where: { createdBy: "u1" } })).toHaveLength(1);
    expect(await prisma.catalogRequest.findMany()).toMatchObject([{ kind: "skill", label: "Rust", value: "rust", requestedBy: "u1", status: "pending" }]);
    expect(await entries()).toEqual([]); // creating changes nothing in the catalog
  });

  it("a value the catalog already has is the person's row for it — nothing to review", async () => {
    await addCatalogItem("skill", "Java");
    expect(await createCatalogValue("skill", "java")).toMatchObject({ success: true, data: { label: "Java", value: "java" } });
    expect(await prisma.catalogRequest.count()).toBe(0);
  });

  it("a bad name and an unknown list are refused and write nothing", async () => {
    expect(await createCatalogValue("skill", "x")).toEqual({ success: false, message: "A name needs 2 to 80 characters." });
    expect(await createCatalogValue("contact", "Rust")).toEqual({ success: false, message: "There is no such list." });
    expect(await prisma.tag.count()).toBe(0);
    expect(await prisma.catalogRequest.count()).toBe(0);
  });

  it("the admin sees the pending ones, with who made them", async () => {
    await createCatalogValue("skill", "Rust");
    ctx.user = { id: "u2" };
    await createCatalogValue("company", "Globex");
    const result = await getCatalogAdminData();
    if (!result.success) throw new Error("expected data");
    expect(result.data.requests.map((r) => [r.kind, r.label, r.requesterName])).toEqual([
      ["skill", "Rust", "Student u1"],
      ["company", "Globex", "Student u2"],
    ]);
  });

  it("approving as it is adds the entry and closes every request for the same thing", async () => {
    await createCatalogValue("skill", "Rust");
    ctx.user = { id: "u2" };
    await createCatalogValue("skill", "RUST");
    const [first] = await prisma.catalogRequest.findMany({ orderBy: { createdAt: "asc" } });

    const result = await approveCatalogItemRequest(first.id, "Rust");

    expect(result).toMatchObject({ success: true, data: { kind: "skill", label: "Rust", value: "rust" } });
    expect((await prisma.catalogRequest.findMany()).map((r) => [r.status, r.decidedByCabinetUserId])).toEqual([
      ["approved", 4242],
      ["approved", 4242],
    ]);
    expect(await entries()).toHaveLength(1);
    // both students' rows now carry the admin's spelling
    expect((await prisma.tag.findMany()).map((t) => t.label)).toEqual(["Rust", "Rust"]);
  });

  it("correcting the spelling: everybody's row under the wrong key becomes one under the right key", async () => {
    await createCatalogValue("company", "Raifeisen Bank");
    ctx.user = { id: "u2" };
    await createCatalogValue("company", "raifeisen bank");
    const [request] = await prisma.catalogRequest.findMany();

    expect(await approveCatalogItemRequest(request.id, "Raiffeisen Bank")).toMatchObject({
      success: true,
      data: { label: "Raiffeisen Bank", value: "raiffeisen bank" },
    });

    expect(await prisma.company.findMany({ select: { createdBy: true, label: true, value: true }, orderBy: { createdBy: "asc" } })).toEqual([
      { createdBy: "u1", label: "Raiffeisen Bank", value: "raiffeisen bank" },
      { createdBy: "u2", label: "Raiffeisen Bank", value: "raiffeisen bank" },
    ]);
    expect((await prisma.catalogRequest.findMany()).map((r) => r.status)).toEqual(["approved", "approved"]);
  });

  it("replacing with an existing entry does the same, by the entry the admin picked", async () => {
    const entry = await addCatalogItem("company", "Raiffeisen Bank");
    if (!entry.success) throw new Error("setup");
    await createCatalogValue("company", "Райфайзен");
    const [request] = await prisma.catalogRequest.findMany();

    expect(await replaceCatalogItemRequest(request.id, entry.data.id)).toMatchObject({ success: true, data: { label: "Raiffeisen Bank" } });

    expect(await prisma.company.findMany({ select: { createdBy: true, value: true } })).toEqual([{ createdBy: "u1", value: "raiffeisen bank" }]);
    expect((await prisma.catalogRequest.findMany())[0]).toMatchObject({ status: "approved", decidedByCabinetUserId: 4242 });
    expect(await entries()).toHaveLength(1); // nothing new in the catalog
  });

  it("an entry of another list, or one that is gone, replaces nothing", async () => {
    const skill = await addCatalogItem("skill", "Java");
    if (!skill.success) throw new Error("setup");
    await createCatalogValue("company", "Acme Inc");
    const [request] = await prisma.catalogRequest.findMany();
    const notFound = { success: false, message: "Not found. It may have been changed already — reload the page." };
    expect(await replaceCatalogItemRequest(request.id, skill.data.id)).toEqual(notFound);
    expect(await replaceCatalogItemRequest(request.id, "nope")).toEqual(notFound);
    expect((await prisma.catalogRequest.findMany())[0].status).toBe("pending");
    expect(await prisma.company.findMany()).toHaveLength(1);
  });

  it("leaving it as it is closes the request; nothing changes for anybody, and it is not asked again", async () => {
    await createCatalogValue("skill", "Rust");
    const [request] = await prisma.catalogRequest.findMany();
    expect(await rejectCatalogItemRequest(request.id)).toEqual({ success: true });
    expect(await entries()).toEqual([]);
    expect(await prisma.tag.count()).toBe(1);
    expect((await prisma.catalogRequest.findMany())[0]).toMatchObject({ status: "rejected", decidedByCabinetUserId: 4242 });
    // a decided request cannot be decided again
    expect(await approveCatalogItemRequest(request.id)).toMatchObject({ success: false });
    // the same person creating it again does not bring the request back
    await createCatalogValue("skill", "Rust");
    expect((await prisma.catalogRequest.findMany())[0].status).toBe("rejected");
  });
});

describe("picking", () => {
  it("makes the person's own row once, with the catalog's key and name", async () => {
    const added = await addCatalogItem("skill", "Selenium");
    if (!added.success) throw new Error("setup");

    const first = await pickCatalogItem(added.data.id);
    const second = await pickCatalogItem(added.data.id);

    expect(first).toMatchObject({ success: true, data: { label: "Selenium", value: "selenium" } });
    expect(second).toEqual(first);
    expect(await prisma.tag.findMany({ where: { createdBy: "u1" } })).toHaveLength(1);
  });

  it("two people get two rows; a company is made as a company", async () => {
    const added = await addCatalogItem("company", "Acme");
    if (!added.success) throw new Error("setup");
    const mine = await pickCatalogItem(added.data.id);
    ctx.user = { id: "u2" };
    const theirs = await pickCatalogItem(added.data.id);
    if (!mine.success || !theirs.success) throw new Error("expected rows");
    expect(mine.data.id).not.toBe(theirs.data.id);
    expect(await prisma.company.findMany({ select: { createdBy: true, value: true }, orderBy: { createdBy: "asc" } })).toEqual([
      { createdBy: "u1", value: "acme" },
      { createdBy: "u2", value: "acme" },
    ]);
  });

  it("an entry that is not there, or no person signed in, makes nothing", async () => {
    expect(await pickCatalogItem("nope")).toEqual({
      success: false,
      message: "Not found. It may have been changed already — reload the page.",
    });
    const added = await addCatalogItem("skill", "Selenium");
    if (!added.success) throw new Error("setup");
    ctx.user = null;
    expect(await pickCatalogItem(added.data.id)).toEqual({ success: false, message: "Sign in again." });
    expect(await createCatalogValue("skill", "Rust")).toEqual({ success: false, message: "Sign in again." });
    expect(await prisma.tag.count()).toBe(0);
    expect(await prisma.catalogRequest.count()).toBe(0);
  });
});

describe("who may", () => {
  it("a student cannot change the catalog — the backend says no — and nothing is written", async () => {
    const added = await addCatalogItem("skill", "Java");
    await createCatalogValue("skill", "Rust");
    const [request] = await prisma.catalogRequest.findMany();
    if (!added.success) throw new Error("setup");
    const before = await state();
    ctx.revalidate.mockClear();

    ctx.admin = null;
    const refused = { success: false, message: ADMIN_ONLY };
    expect(await addCatalogItem("skill", "Python")).toEqual(refused);
    expect(await renameCatalogItem(added.data.id, "Java 8")).toEqual(refused);
    expect(await removeCatalogItem(added.data.id)).toEqual(refused);
    expect(await approveCatalogItemRequest(request.id)).toEqual(refused);
    expect(await replaceCatalogItemRequest(request.id, added.data.id)).toEqual(refused);
    expect(await rejectCatalogItemRequest(request.id)).toEqual(refused);

    expect(await state()).toBe(before);
    expect(ctx.revalidate).not.toHaveBeenCalled();
    // the same calls by the admin do change it
    ctx.admin = 4242;
    expect(await addCatalogItem("skill", "Python")).toMatchObject({ success: true });
  });

  it("a student does not get the admin's data", async () => {
    ctx.adminSession = false;
    expect(await getCatalogAdminData()).toEqual({ success: false, message: ADMIN_ONLY });
    ctx.adminSession = true;
    expect(await getCatalogAdminData()).toMatchObject({ success: true });
  });
});

describe("the switch is off", () => {
  it("every action refuses and writes nothing — and the same calls work when it is on", async () => {
    const added = await addCatalogItem("skill", "Java");
    if (!added.success) throw new Error("setup");
    await createCatalogValue("skill", "Rust");
    const [request] = await prisma.catalogRequest.findMany();
    const before = await state();
    ctx.revalidate.mockClear();

    ctx.on = false;
    const off = { success: false, message: OFF_MESSAGE };
    expect(await getCatalogAdminData()).toEqual(off);
    expect(await addCatalogItem("skill", "Python")).toEqual(off);
    expect(await renameCatalogItem(added.data.id, "Java 8")).toEqual(off);
    expect(await removeCatalogItem(added.data.id)).toEqual(off);
    expect(await approveCatalogItemRequest(request.id)).toEqual(off);
    expect(await rejectCatalogItemRequest(request.id)).toEqual(off);
    expect(await replaceCatalogItemRequest(request.id, added.data.id)).toEqual(off);
    expect(await createCatalogValue("skill", "Go")).toEqual(off);
    expect(await pickCatalogItem(added.data.id)).toEqual(off);

    expect(await state()).toBe(before);
    expect(ctx.revalidate).not.toHaveBeenCalled();

    ctx.on = true;
    expect(await pickCatalogItem(added.data.id)).toMatchObject({ success: true });
    expect(await createCatalogValue("skill", "Go")).toMatchObject({ success: true });
  });
});
