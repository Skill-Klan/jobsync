// @vitest-environment node
// Requirement — the owner, 2026-11-22 (SKD-60): a student who studies by the
// school's spreadsheet has their plan here before they ever sign in, with the
// points they passed already ticked.
//   · only an admin, asked again now, imports; a switched-off plans area refuses;
//   · the preview writes nothing;
//   · students are the backend's lists only: a student the lists lack, a tab the
//     file lacks, a tab with no passed point, a student or a tab picked twice —
//     all refused and nothing written; a list that did not load fails closed;
//   · for a picked student: an account without a sign-in (the cabinet id, no
//     lastLoginAt), the track's plan if they have none, the passed points ticked;
//   · what is already ticked stays (and keeps its date), nothing is unticked,
//     a second import changes nothing;
//   · the student's first real sign-in finds that account and its plan;
//   · tabs whose first name is shared are offered as choices; a bracket naming
//     the mentor preselects only when it leaves exactly one.
// Real SQLite with the current schema, real Prisma; the backend is a fake.
import { Prisma, PrismaClient } from "@prisma/client";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return {
    url,
    dir,
    admin: { value: 9000 as number | null },
    mentors: vi.fn(),
    students: vi.fn(),
    without: vi.fn(),
  };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/skillklan/cabinetAdmin", () => ({
  confirmCabinetAdmin: vi.fn(async () => ctx.admin.value),
  isAdminSession: vi.fn(async () => ctx.admin.value !== null),
}));
vi.mock("@/skillklan/cabinetApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/skillklan/cabinetApi")>()),
  listMentors: ctx.mentors,
  listMentorStudents: ctx.students,
  listStudentsWithoutMentor: ctx.without,
}));

import { applyPlanImport, previewPlanImport } from "@/skillklan/plans/importHandlers";
import { candidatesFor } from "@/skillklan/plans/importFlow";
import { findOrCreateCabinetUser } from "@/skillklan/cabinetUser";
import { getPlanTemplate, type PlanNode } from "@/skillklan/plans/template";
import { ACCESS_SHARE_MS } from "@/skillklan/accessRecheck";
import { HEADER, makeWorkbook } from "../helpers/makeWorkbook";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

// The points of the real Java template: [topic, text], in reading order.
function javaPoints(): [string, string][] {
  const out: [string, string][] = [];
  const walk = (nodes: PlanNode[], topic: string) => {
    for (const n of nodes) {
      if (n.kind === "item") out.push([topic, n.title]);
      walk(n.children ?? [], n.kind === "topic" ? n.title : topic);
    }
  };
  walk(getPlanTemplate("java")!.children, "");
  return out;
}
const POINTS = javaPoints();

// A tab as the school keeps it: every point of the template, a mark on `passed`
// of them (by index), made-up names only.
function tabRows(passed: number[], extra: string[][] = []): string[][] {
  const rows: string[][] = [HEADER];
  let topic = "";
  POINTS.forEach(([t, text], i) => {
    if (t !== topic) {
      topic = t;
      rows.push(["", t, "", "", ""]);
    }
    rows.push(["", "", "", text, passed.includes(i) ? "Залік" : "Практика"]);
  });
  return [...rows, ...extra];
}
const book = (tabs: { name: string; passed: number[] }[]) =>
  makeWorkbook(tabs.map((t) => ({ name: t.name, rows: tabRows(t.passed) })));

function form(data: Uint8Array, extra: Record<string, string> = {}, track = "java") {
  const f = new FormData();
  f.set("file", new File([data as BlobPart], "Java.xlsx"));
  f.set("track", track);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}
const picks = (...p: { tab: string; userId: number }[]) => ({ picks: JSON.stringify(p) });

const setSwitch = (enabled: boolean) =>
  prisma.featureToggle.upsert({ where: { key: "plans" }, create: { key: "plans", enabled }, update: { enabled } });
// The accounts the tests made, with what a new account is seeded with.
const wipe = async () => {
  await prisma.planItem.deleteMany();
  await prisma.plan.deleteMany();
  const ids = (await prisma.user.findMany({ where: { cabinetUserId: { not: null } }, select: { id: true } })).map((u) => u.id);
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.type !== "User" || !field.relationFromFields?.length) continue;
      const name = model.name[0].toLowerCase() + model.name.slice(1);
      await (prisma as never as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)[name].deleteMany({
        where: { [field.relationFromFields[0]]: { in: ids } },
      });
    }
  }
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
};

beforeAll(async () => {
  await setSwitch(true);
});
afterAll(async () => {
  await prisma.$disconnect();
  const fs = await import("fs");
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});
beforeEach(async () => {
  await wipe();
  ctx.admin.value = 9000;
  // Time moves past the shared answers of the previous test.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + ACCESS_SHARE_MS * 2 * ++tick);
  ctx.mentors.mockResolvedValue([{ mentorId: 1, name: "Борис Тестовий", direction: "QA" }]);
  ctx.students.mockResolvedValue([
    { userId: 501, name: "Марія Перша" },
    { userId: 502, name: "Вадим Другий" },
  ]);
  ctx.without.mockResolvedValue([{ userId: 503, name: "Олег Третій" }]);
});
afterEach(() => vi.useRealTimers());
let tick = 0;

const ticked = async (cabinetUserId: number) =>
  prisma.planItem.count({ where: { done: true, plan: { user: { cabinetUserId } } } });

describe("who may import", () => {
  it("refuses a caller the backend does not confirm as an admin, and writes nothing", async () => {
    ctx.admin.value = null;
    const data = await book([{ name: "Марія", passed: [0, 1] }]);
    expect(await previewPlanImport(form(data))).toMatchObject({ success: false });
    expect(await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })))).toMatchObject({ success: false });
    expect(await prisma.user.count({ where: { cabinetUserId: 501 } })).toBe(0);
  });

  it("refuses while the plans area is switched off, and works again when it is on", async () => {
    const data = await book([{ name: "Марія", passed: [0] }]);
    await setSwitch(false);
    expect(await previewPlanImport(form(data))).toMatchObject({ success: false });
    expect(await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })))).toMatchObject({ success: false });
    expect(await prisma.user.count({ where: { cabinetUserId: 501 } })).toBe(0);
    await setSwitch(true);
    expect(await previewPlanImport(form(data))).toMatchObject({ success: true });
  });

  it("refuses a file that is not a workbook, an unknown track and no file", async () => {
    expect(await previewPlanImport(form(new Uint8Array([1, 2, 3])))).toMatchObject({ success: false });
    const data = await book([{ name: "Марія", passed: [0] }]);
    expect(await previewPlanImport(form(data, {}, "cobol"))).toMatchObject({ success: false });
    const empty = new FormData();
    empty.set("track", "java");
    expect(await previewPlanImport(empty)).toMatchObject({ success: false });
  });
});

describe("the preview", () => {
  it("offers the student of the same first name, counts the passed points, skips tabs with none, and writes nothing", async () => {
    const data = await book([
      { name: "Марія (Борис)", passed: [0, 1, 2] },
      { name: "Вікторія", passed: [] },
    ]);
    const result = await previewPlanImport(form(data));
    if (!result.success) throw new Error("setup");
    expect(result.data.skipped).toEqual([{ tab: "Вікторія", reason: "noProgress" }]);
    expect(result.data.tabs).toHaveLength(1);
    expect(result.data.tabs[0]).toMatchObject({
      tab: "Марія (Борис)",
      passed: 3,
      preselected: 501,
      account: false,
      plan: false,
      willMark: 3,
      missing: [],
    });
    expect(result.data.tabs[0].candidates.map((c) => c.userId)).toEqual([501]);
    expect(await prisma.user.count({ where: { cabinetUserId: { not: null } } })).toBe(0);
    expect(await prisma.plan.count()).toBe(0);
  });

  it("a list that could not be loaded fails closed: no preview and no write", async () => {
    ctx.students.mockResolvedValue(null);
    const data = await book([{ name: "Марія", passed: [0] }]);
    expect(await previewPlanImport(form(data))).toMatchObject({ success: false });
    expect(await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })))).toMatchObject({ success: false });
    expect(await prisma.user.count({ where: { cabinetUserId: 501 } })).toBe(0);
  });

  it("reports passed rows the template does not have", async () => {
    const data = await makeWorkbook([
      { name: "Марія", rows: tabRows([0], [["", "Тема з минулої версії", "", "Старий пункт", "Залік"]]) },
    ]);
    const result = await previewPlanImport(form(data));
    if (!result.success) throw new Error("setup");
    expect(result.data.tabs[0]).toMatchObject({ willMark: 1, missing: [{ topic: "Тема з минулої версії", text: "Старий пункт" }] });
  });
});

describe("importing", () => {
  it("creates the account without a sign-in, gives the plan and ticks exactly the passed points", async () => {
    const passed = [0, 1, 5, 40];
    const data = await book([{ name: "Марія (Борис)", passed }]);
    const result = await applyPlanImport(form(data, picks({ tab: "Марія (Борис)", userId: 501 })));
    expect(result).toMatchObject({ success: true, data: { results: [{ ok: true, accountCreated: true, planCreated: true, marked: 4 }] } });

    const user = await prisma.user.findUniqueOrThrow({ where: { cabinetUserId: 501 } });
    expect(user).toMatchObject({ name: "Марія Перша", lastLoginAt: null, email: "cabinet-501@users.jobs.skillklan.invalid" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { userId_track: { userId: user.id, track: "java" } } });
    const doneRows = await prisma.planItem.findMany({ where: { planId: plan.id, done: true }, include: { parent: { include: { parent: true } } } });
    expect(doneRows.map((r) => r.title).sort()).toEqual(passed.map((i) => POINTS[i][1]).sort());
    expect(doneRows.every((r) => r.kind === "item" && r.doneAt !== null)).toBe(true);
  });

  it("the student's first sign-in finds that account, and the plan with its ticks is there", async () => {
    const data = await book([{ name: "Марія", passed: [2, 3] }]);
    await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })));
    const made = await prisma.user.findUniqueOrThrow({ where: { cabinetUserId: 501 } });

    const signedIn = await findOrCreateCabinetUser({ userId: 501, role: "student", name: "Марія Перша" });
    expect(signedIn.id).toBe(made.id);
    expect(signedIn.lastLoginAt).not.toBeNull();
    expect(await prisma.user.count({ where: { cabinetUserId: 501 } })).toBe(1);
    expect(await ticked(501)).toBe(2);
  });

  it("a student who already has the plan keeps every tick and its date; only the rest is added; nothing is unticked", async () => {
    const first = await book([{ name: "Марія", passed: [0, 1] }]);
    await applyPlanImport(form(first, picks({ tab: "Марія", userId: 501 })));
    const user = await prisma.user.findUniqueOrThrow({ where: { cabinetUserId: 501 } });
    const before = await prisma.planItem.findMany({ where: { done: true, plan: { userId: user.id } } });
    const mine = before[0];
    // The student ticked another point themself, which the sheet does not know.
    const own = await prisma.planItem.findFirstOrThrow({ where: { plan: { userId: user.id }, kind: "item", done: false, title: POINTS[60][1] } });
    await prisma.planItem.update({ where: { id: own.id }, data: { done: true, doneAt: new Date("2026-01-01") } });
    vi.setSystemTime(Date.now() + 60_000);

    const second = await book([{ name: "Марія", passed: [1, 2, 3] }]);
    const result = await applyPlanImport(form(second, picks({ tab: "Марія", userId: 501 })));
    expect(result).toMatchObject({ success: true, data: { results: [{ planCreated: false, accountCreated: false, marked: 2, alreadyDone: 1 }] } });

    expect(await ticked(501)).toBe(2 + 2 + 1); // 0,1 before; +2,3 now; plus the student's own
    const same = await prisma.planItem.findUniqueOrThrow({ where: { id: mine.id } });
    expect(same.done).toBe(true);
    expect(same.doneAt).toEqual(mine.doneAt);
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: own.id } })).doneAt).toEqual(new Date("2026-01-01"));
  });

  it("running the same import twice changes nothing the second time", async () => {
    const data = await book([{ name: "Марія", passed: [0, 1, 2] }]);
    await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })));
    const result = await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 })));
    expect(result).toMatchObject({ success: true, data: { results: [{ planCreated: false, accountCreated: false, marked: 0, alreadyDone: 3 }] } });
    expect(await prisma.plan.count()).toBe(1);
    expect(await ticked(501)).toBe(3);
  });

  it("imports several students at once, each into their own plan", async () => {
    const data = await book([
      { name: "Марія", passed: [0, 1] },
      { name: "Вадим", passed: [5] },
    ]);
    const result = await applyPlanImport(form(data, picks({ tab: "Марія", userId: 501 }, { tab: "Вадим", userId: 502 })));
    expect(result).toMatchObject({ success: true });
    expect(await ticked(501)).toBe(2);
    expect(await ticked(502)).toBe(1);
  });

  it("refuses a student the backend's lists do not hold, a missing tab, a tab with no passed point, and doubles — writing nothing", async () => {
    const data = await book([
      { name: "Марія", passed: [0] },
      { name: "Вадим", passed: [] },
    ]);
    const refused = async (...p: { tab: string; userId: number }[]) =>
      expect(await applyPlanImport(form(data, picks(...p)))).toMatchObject({ success: false });
    await refused({ tab: "Марія", userId: 999 });
    await refused({ tab: "Немає", userId: 501 });
    await refused({ tab: "Вадим", userId: 502 });
    await refused({ tab: "Марія", userId: 501 }, { tab: "Марія", userId: 502 });
    await refused({ tab: "Марія", userId: 501 }, { tab: "Вадим", userId: 501 });
    expect(await applyPlanImport(form(data, { picks: "not json" }))).toMatchObject({ success: false });
    expect(await applyPlanImport(form(data, { picks: "[]" }))).toMatchObject({ success: false });
    expect(await prisma.user.count({ where: { cabinetUserId: { not: null } } })).toBe(0);
    expect(await prisma.plan.count()).toBe(0);
  });
});

describe("which student a tab is offered", () => {
  const pool = [
    { userId: 1, name: "Борис Малий", mentors: ["Роман Тестовий"] },
    { userId: 2, name: "Іван Перший", mentors: ["Борис Тестовий"] },
    { userId: 3, name: "Іван Другий", mentors: ["Денис Тестовий"] },
  ];
  it("one first name → that student", () => {
    expect(candidatesFor({ firstName: "борис", hint: "" }, pool)).toMatchObject({ preselected: 1 });
  });
  it("two with the same first name → the admin chooses, unless the bracket names exactly one's mentor", () => {
    expect(candidatesFor({ firstName: "Іван", hint: "" }, pool)).toMatchObject({ preselected: null });
    expect(candidatesFor({ firstName: "Іван", hint: "mentor_x" }, pool)).toMatchObject({ preselected: null });
    expect(candidatesFor({ firstName: "Іван", hint: "Борис" }, pool)).toMatchObject({ preselected: 2 });
    expect(candidatesFor({ firstName: "Іван", hint: "Борис" }, pool).candidates).toHaveLength(2);
  });
  it("nobody of that name → no candidates", () => {
    expect(candidatesFor({ firstName: "Ярема", hint: "" }, pool)).toEqual({ candidates: [], preselected: null });
  });
});
