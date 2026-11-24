// @vitest-environment node
// Requirement — the owner, 2026-11-24 (docs/decisions.md D118): «при першому вході людина обовʼязково має
// додивитись до кінця, а потім мати можливість закрити кнопкою „Все зрозуміло“… на наступні входи вже показувати
// не треба», with a video for each of two roles — a student and a mentor:
//   · a person who has not watched it gets it by itself; once watched to the end and closed — never again,
//     and that stays when they later change the theme or the daily goals (the record lives in their settings);
//   · the first time is kept: closing it again (from the menu) does not move the date;
//   · the admin and the QA moderator are never made to watch it;
//   · which video is the backend's answer (a mentor is the school's records, not a role — D89): a mentor gets
//     the mentor's, anyone else the student's; the backend away → no video now (not a guess), asked again later;
//   · only the two videos can be recorded, and only for a signed-in person.
// Real SQLite with the current schema, real Prisma; the backend is the app's own stand-in, in-process.
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { createBackendStub } from "../../skillklan/dev/backend-stub.mjs";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, session: { value: null as null | { user: { id: string } } } };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/auth", () => ({ auth: async () => ctx.session.value }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { finishOnboarding, getOnboardingVideo } from "@/actions/onboarding.actions";
import { onboardingRequired, readOnboarding, recordOnboarding } from "@/skillklan/onboarding/state";
import { updateUserSettings } from "@/actions/userSettings.actions";
import { updateGoalTargets } from "@/actions/dailyGoals.actions";

const SECRET = "local-test-secret-0123456789abcdef";
const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });
const as = (id: string | null) => (ctx.session.value = id ? { user: { id } } : null);
let n = 0;
// A cabinet id is unique: the same person again is the same account.
const makeUser = async (cabinetUserId: number | null = null) =>
  (cabinetUserId !== null && (await prisma.user.findUnique({ where: { cabinetUserId } }))?.id) ||
  (await prisma.user.create({ data: { name: `U${++n}`, email: `u${n}@users.invalid`, password: "-", cabinetUserId } })).id;

// The stand-in: 1004 is a mentor (DEFAULT_MENTORS), 1001 a student.
let stub: ReturnType<typeof createBackendStub>;
beforeAll(async () => {
  stub = createBackendStub({ secret: SECRET });
  await new Promise<void>((resolve) => stub.server.listen(0, "127.0.0.1", () => resolve()));
});
afterAll(async () => {
  await new Promise((resolve) => stub.server.close(resolve));
  await prisma.$disconnect();
});
const backendUp = () => {
  const { port } = stub.server.address() as AddressInfo;
  vi.stubEnv("SKILLKLAN_API_URL", `http://127.0.0.1:${port}`);
  vi.stubEnv("JOBSYNC_API_SECRET", SECRET);
};
beforeEach(() => {
  // The backend's answers are shared for 30 s per viewer (mentorPlans.ts): every case starts clean.
  (globalThis as { skillklanSharedMentorLists?: Map<string, unknown> }).skillklanSharedMentorLists?.clear();
  backendUp();
});
afterEach(() => {
  vi.unstubAllEnvs();
  as(null);
});

describe("watched once — never again", () => {
  it("a person who has not watched it must; after watching to the end and closing — not any more", async () => {
    const id = await makeUser();
    expect(await onboardingRequired(id, false)).toBe(true);

    as(id);
    expect(await finishOnboarding("student")).toEqual({ success: true });

    expect(await onboardingRequired(id, false)).toBe(false);
    expect(await readOnboarding(id)).toMatchObject({ video: "student" });
  });

  it("the record survives a later change of the theme and of the daily goals, and keeps what was there", async () => {
    const id = await makeUser();
    const goals = { targets: { "2026-11": { jobs: 3, hours: 2 } } };
    await prisma.userSettings.create({
      data: { userId: id, settings: JSON.stringify({ display: { theme: "dark" }, goals }) },
    });
    as(id);
    await finishOnboarding("mentor");

    // Finishing kept the theme and the goals…
    const afterFinish = JSON.parse((await prisma.userSettings.findUniqueOrThrow({ where: { userId: id } })).settings);
    expect(afterFinish.display.theme).toBe("dark");
    expect(afterFinish.goals).toEqual(goals);

    // …and the other writers keep the record.
    expect(await updateUserSettings({ display: { theme: "light" } } as never)).toMatchObject({ success: true });
    expect(await updateGoalTargets({ month: "2026-11", jobs: 4, hours: 3 })).toMatchObject({ success: true });
    expect(await readOnboarding(id)).toMatchObject({ video: "mentor" });
    expect(await onboardingRequired(id, false)).toBe(false);
  });

  it("the first time is kept when it is closed again", async () => {
    const id = await makeUser();
    await recordOnboarding(id, "student", new Date("2026-11-24T10:00:00Z"));
    await recordOnboarding(id, "student", new Date("2026-12-01T10:00:00Z"));
    expect(await readOnboarding(id)).toEqual({ video: "student", finishedAt: "2026-11-24T10:00:00.000Z" });
  });
});

describe("who must watch it", () => {
  it("the admin and the QA moderator never must; anyone else must until they have watched it", async () => {
    const id = await makeUser();
    expect(await onboardingRequired(id, true)).toBe(false);
    expect(await onboardingRequired(id, false)).toBe(true);
  });
});

describe("which video", () => {
  it("a mentor in the school's records gets the mentor's video", async () => {
    as(await makeUser(1004));
    expect(await getOnboardingVideo()).toEqual({ success: true, data: { video: "mentor" } });
  });

  it("a student gets the student's video", async () => {
    as(await makeUser(1001));
    expect(await getOnboardingVideo()).toEqual({ success: true, data: { video: "student" } });
  });

  it("an account without a cabinet id (development only) gets the student's video without asking the backend", async () => {
    vi.unstubAllEnvs(); // no backend configured at all
    as(await makeUser(null));
    expect(await getOnboardingVideo()).toEqual({ success: true, data: { video: "student" } });
  });

  it("the backend away: no video now — not the student's by guess", async () => {
    vi.stubEnv("SKILLKLAN_API_URL", "http://127.0.0.1:9"); // nothing listens there
    as(await makeUser(1004));
    expect(await getOnboardingVideo()).toMatchObject({ success: false });
  });

  it("nobody signed in: no video", async () => {
    expect(await getOnboardingVideo()).toMatchObject({ success: false });
  });
});

describe("what can be recorded", () => {
  it("only the two videos, only for a signed-in person — nothing written otherwise", async () => {
    const id = await makeUser();
    as(id);
    expect(await finishOnboarding("admin")).toMatchObject({ success: false });
    expect(await finishOnboarding(undefined)).toMatchObject({ success: false });
    as(null);
    expect(await finishOnboarding("student")).toMatchObject({ success: false });
    expect(await readOnboarding(id)).toBeNull();
    // The paired case: the same person, signed in, a real video — recorded.
    as(id);
    expect(await finishOnboarding("student")).toEqual({ success: true });
    expect(await readOnboarding(id)).toMatchObject({ video: "student" });
  });
});
