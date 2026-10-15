// @vitest-environment node
// Requirement — one SkillKlan Job account per cabinet person:
//   · the first sign-in creates it and seeds it exactly like a signed-up
//     account (job sources, contact roles, statuses, stage types);
//   · later sign-ins find the same account (no second seeding) and keep the
//     name in step with the cabinet;
//   · no personal data crosses the boundary, so the email is a placeholder
//     on the reserved .invalid TLD and the password is unusable;
//   · an account never exists half-seeded: if seeding fails, nothing is kept
//     and the next sign-in starts clean;
//   · two first sign-ins at once end with one account.
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CONTACT_ROLES, JOB_SOURCES, JOB_STAGES, JOB_STATUSES } from "@/lib/constants";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir, failSeeding: { on: false } };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});

vi.mock("@/lib/account/seedNewAccount", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/account/seedNewAccount")>();
  return {
    seedNewAccount: async (...args: Parameters<typeof actual.seedNewAccount>) => {
      await actual.seedNewAccount(...args);
      if (ctx.failSeeding.on) throw new Error("seeding failed half-way");
    },
  };
});

import appPrisma from "@/lib/db";
import { cabinetEmail, findOrCreateCabinetUser } from "@/skillklan/cabinetUser";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

async function seededCounts(userId: string) {
  return {
    sources: await prisma.jobSource.count({ where: { createdBy: userId } }),
    roles: await prisma.contactRole.count({ where: { createdBy: userId } }),
    stages: await prisma.jobStageType.count({ where: { createdBy: userId } }),
  };
}

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe("findOrCreateCabinetUser", () => {
  it("first sign-in creates a seeded account tied to the cabinet id", async () => {
    const user = await findOrCreateCabinetUser({ userId: 101, role: "student", name: "Марія Тестова" });

    expect(user).toMatchObject({ cabinetUserId: 101, name: "Марія Тестова", email: cabinetEmail(101) });
    expect(user.email).toMatch(/\.invalid$/);
    expect(await bcrypt.compare("", user.password)).toBe(false);
    expect(await seededCounts(user.id)).toEqual({
      sources: JOB_SOURCES.length,
      roles: CONTACT_ROLES.length,
      stages: JOB_STAGES.length,
    });
    expect(await prisma.jobStatus.count()).toBeGreaterThanOrEqual(JOB_STATUSES.length);
  });

  it("later sign-ins find the same account, seed nothing again, and follow the cabinet name", async () => {
    const first = await findOrCreateCabinetUser({ userId: 102, role: "student", name: "Old Name" });
    const before = await seededCounts(first.id);

    const second = await findOrCreateCabinetUser({ userId: 102, role: "student", name: "New Name" });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("New Name");
    expect(await prisma.user.count({ where: { cabinetUserId: 102 } })).toBe(1);
    expect(await seededCounts(first.id)).toEqual(before);
  });

  // SkillKlan admin (JA2): "who came in, and when last" — every sign-in, not
  // just the first one and not only when the name changed.
  it("every sign-in stamps lastLoginAt — the first, and each later one even with the same name", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-01T08:00:00.000Z"));
      const first = await findOrCreateCabinetUser({ userId: 110, role: "student", name: "Same Name" });
      expect(first.lastLoginAt?.toISOString()).toBe("2026-10-01T08:00:00.000Z");

      vi.setSystemTime(new Date("2026-10-09T17:30:00.000Z"));
      const again = await findOrCreateCabinetUser({ userId: 110, role: "student", name: "Same Name" });
      expect(again.id).toBe(first.id);
      const stored = await prisma.user.findUnique({ where: { cabinetUserId: 110 } });
      expect(stored?.lastLoginAt?.toISOString()).toBe("2026-10-09T17:30:00.000Z");
      // The account's first sign-in stays where it was.
      expect(stored?.createdAt.toISOString()).toBe(first.createdAt.toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  it("different cabinet people get different accounts", async () => {
    const a = await findOrCreateCabinetUser({ userId: 103, role: "student", name: "A" });
    const b = await findOrCreateCabinetUser({ userId: 104, role: "admin", name: "B" });
    expect(a.id).not.toBe(b.id);
  });

  it("an empty cabinet name gets a neutral fallback", async () => {
    const user = await findOrCreateCabinetUser({ userId: 105, role: "student", name: "   " });
    expect(user.name).toBe("SkillKlan student");
  });

  it("seeding fails — no half-made account is kept; the next sign-in starts clean", async () => {
    ctx.failSeeding.on = true;
    await expect(findOrCreateCabinetUser({ userId: 106, role: "student", name: "X" })).rejects.toThrow(/seeding failed/);
    ctx.failSeeding.on = false;
    expect(await prisma.user.count({ where: { cabinetUserId: 106 } })).toBe(0);

    const user = await findOrCreateCabinetUser({ userId: 106, role: "student", name: "X" });
    expect(await seededCounts(user.id)).toEqual({
      sources: JOB_SOURCES.length,
      roles: CONTACT_ROLES.length,
      stages: JOB_STAGES.length,
    });
  });

  it("a first sign-in that loses the race to another reads the winner's account", async () => {
    const winner = await findOrCreateCabinetUser({ userId: 107, role: "student", name: "Winner" });
    // The loser looked before the winner committed: it saw no account.
    vi.spyOn(appPrisma.user, "findUnique").mockResolvedValueOnce(null);

    const loser = await findOrCreateCabinetUser({ userId: 107, role: "student", name: "Winner" });

    expect(loser.id).toBe(winner.id);
    expect(await prisma.user.count({ where: { cabinetUserId: 107 } })).toBe(1);
  });
});
