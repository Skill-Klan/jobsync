// @vitest-environment node
// Requirement — product notes, 2026-11-03: «Навички» in the job form started
// empty, so every student typed Java, Selenium, Postman… by hand. A new account
// now starts with the skills the study plan tracks lead to (Java, JavaScript,
// Python, Manual QA):
//   · the list is there, each skill once, names as written (tool names are not
//     translated);
//   · a skill's stored value is what typing its name resolves to
//     (canonicalizeEntityValue) — otherwise the first time a student types
//     "Java" the picker mints a second "Java";
//   · a new account is seeded with all of them, as that person's own tags;
//   · two accounts do not share them (a tag belongs to one person).
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SKILLS } from "@/lib/constants";
import { canonicalizeEntityValue } from "@/lib/jobs/canonicalize";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("../helpers/backupTestDb");
  const { url, dir } = helpers.makeTestDbUrl();
  helpers.pushSchema(url);
  return { url, dir };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});

import appPrisma from "@/lib/db";
import { findOrCreateCabinetUser } from "@/skillklan/cabinetUser";

const prisma = new PrismaClient({ datasources: { db: { url: ctx.url } } });

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe("default skills", () => {
  it("covers what the four tracks teach, each skill once", () => {
    const labels = DEFAULT_SKILLS.map((s) => s.label);
    for (const skill of ["Java", "JavaScript", "Python", "Selenium", "Playwright", "Postman", "SQL", "Git", "Manual Testing", "Jira"]) {
      expect(labels).toContain(skill);
    }
    expect(new Set(DEFAULT_SKILLS.map((s) => s.value)).size).toBe(DEFAULT_SKILLS.length);
  });

  // Typing «java» in the creatable picker resolves to canonicalizeEntityValue
  // («java»); a seeded value that differs would duplicate the skill.
  it("every stored value is what typing the name resolves to", () => {
    for (const { label, value } of DEFAULT_SKILLS) {
      expect(value).toBe(canonicalizeEntityValue(label));
    }
  });

  it("a new account is seeded with all of them, names as written", async () => {
    const user = await findOrCreateCabinetUser({ userId: 301, role: "student", name: "Тест Навичок" });

    const stored = await prisma.tag.findMany({ where: { createdBy: user.id } });

    expect(stored).toHaveLength(DEFAULT_SKILLS.length);
    expect(Object.fromEntries(stored.map((t) => [t.value, t.label]))).toEqual(
      Object.fromEntries(DEFAULT_SKILLS.map((s) => [s.value, s.label])),
    );
  });

  it("another new account gets its own copy; neither sees the other's", async () => {
    const first = await findOrCreateCabinetUser({ userId: 302, role: "student", name: "Перша" });
    const second = await findOrCreateCabinetUser({ userId: 303, role: "student", name: "Друга" });

    const ids = (await prisma.tag.findMany({ where: { createdBy: { in: [first.id, second.id] } }, select: { id: true } })).map((t) => t.id);
    expect(ids).toHaveLength(DEFAULT_SKILLS.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(await prisma.tag.count({ where: { createdBy: first.id } })).toBe(DEFAULT_SKILLS.length);
  });
});
