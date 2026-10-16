// @vitest-environment node
// Requirement — the owner, 2026-10-16: feature switches in Settings → «Функції»,
// "and only the admin may manage them; for everyone else such settings are
// not shown". Activities is the first switch, and it starts off.
//   · no row in the database → Activities off (the launch state);
//   · an admin turns a switch on or off for everyone; who did it is kept;
//   · "admin" is the backend's answer at the moment of the change — not the
//     session's: a token minted before a demotion still says admin, and a
//     server action can be called without the button. No session, a dev-only
//     password account, a "no" or no answer from the backend → refused, and
//     nothing is written;
//   · only switches from the list; nothing but true / false.
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
vi.mock("@/skillklan/cabinetApi", () => ({ getCabinetAccess: ctx.access }));
vi.mock("next/cache", () => ({ revalidatePath: ctx.revalidate }));

import { setFeatureEnabled } from "@/actions/featureToggles.actions";
import { readFeatureFlags } from "@/skillklan/featureFlags";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

const ADMIN_CABINET_ID = 42;
let adminUserId: string;
let devUserId: string;

beforeAll(async () => {
  adminUserId = (
    await prisma.user.create({
      data: { name: "Адмін", email: "cabinet-42@users.jobs.skillklan.invalid", password: "-", cabinetUserId: ADMIN_CABINET_ID },
    })
  ).id;
  devUserId = (
    await prisma.user.create({ data: { name: "Dev", email: "dev@example.invalid", password: "-" } })
  ).id;
});

beforeEach(async () => {
  await prisma.featureToggle.deleteMany();
  ctx.access.mockReset();
  ctx.revalidate.mockReset();
  ctx.session.value = { user: { id: adminUserId, isAdmin: true } };
});

afterAll(async () => {
  await prisma.$disconnect();
});

const rows = () => prisma.featureToggle.findMany();

describe("launch state", () => {
  it("no row → Activities off for everyone", async () => {
    await expect(readFeatureFlags()).resolves.toEqual({ activities: false });
  });
});

describe("an admin, confirmed by the backend now", () => {
  beforeEach(() => ctx.access.mockResolvedValue({ allowed: true, role: "admin" }));

  it("turns Activities on for everyone — stored with who did it; menus re-render", async () => {
    await expect(setFeatureEnabled("activities", true)).resolves.toEqual({
      success: true,
      data: { activities: true },
    });
    expect(ctx.access).toHaveBeenCalledWith(ADMIN_CABINET_ID);
    expect(await rows()).toMatchObject([
      { key: "activities", enabled: true, updatedByCabinetUserId: ADMIN_CABINET_ID },
    ]);
    await expect(readFeatureFlags()).resolves.toEqual({ activities: true });
    expect(ctx.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("and back off — the same row, now false", async () => {
    await setFeatureEnabled("activities", true);
    await expect(setFeatureEnabled("activities", false)).resolves.toMatchObject({
      success: true,
      data: { activities: false },
    });
    expect(await rows()).toMatchObject([{ key: "activities", enabled: false }]);
  });
});

describe("refused, nothing written", () => {
  it.each([
    ["the session says admin, the backend says student (demoted)", { allowed: true, role: "student" }],
    ["the backend no longer lets the person in", { allowed: false, role: null }],
    ["an allowed person with a role we do not know", { allowed: true, role: null }],
  ])("%s", async (_label, answer) => {
    ctx.access.mockResolvedValue(answer);
    const result = await setFeatureEnabled("activities", true);
    expect(result).toEqual({ success: false, message: expect.any(String) });
    expect(await rows()).toEqual([]);
  });

  it("the backend did not answer — fail closed", async () => {
    ctx.access.mockRejectedValue(new Error("timeout"));
    await expect(setFeatureEnabled("activities", true)).resolves.toMatchObject({ success: false });
    expect(await rows()).toEqual([]);
  });

  it("no session — the backend is not even asked", async () => {
    ctx.session.value = null;
    await expect(setFeatureEnabled("activities", true)).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it("a dev-only password account (no cabinet person) — the backend is not asked", async () => {
    ctx.session.value = { user: { id: devUserId, isAdmin: true } };
    await expect(setFeatureEnabled("activities", true)).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it.each([
    ["a switch that is not in the list", "automations", true],
    ["a name from the object prototype", "toString", true],
    ["not a boolean", "activities", "false"],
  ])("%s — refused before asking the backend", async (_label, key, enabled) => {
    ctx.access.mockResolvedValue({ allowed: true, role: "admin" });
    await expect(setFeatureEnabled(key, enabled)).resolves.toMatchObject({ success: false });
    expect(ctx.access).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });
});
