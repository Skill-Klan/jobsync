// @vitest-environment node
// Requirement — product owner's testing notes: students look for jobs on
// Ukrainian boards, but the default sources had only LinkedIn from them.
//   · every new account starts with "DOU" (value "dou") and "Djinni" (value
//     "djinni"), placed right after LinkedIn;
//   · owner, 2026-10-30: boards that nobody in the Ukrainian market uses are
//     not offered by default — Indeed, Monster, Glassdoor, ZipRecruiter and
//     Job Street are gone; Linkedin, the company's own page, Google and
//     "Other" stay;
//   · owner, 2026-10-30: Work.ua and Robota.ua are offered too, after Djinni;
//   · the order is Linkedin, DOU, Djinni, Work.ua, Robota.ua, Google,
//     Company Career page, Other;
//   · the labels are brand names — kept as written (D29/D30), not translated.
// Real SQLite with the current schema (db push), real Prisma.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { JOB_SOURCES } from "@/lib/constants";

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

const EXPECTED = [
  { label: "Linkedin", value: "linkedin" },
  { label: "DOU", value: "dou" },
  { label: "Djinni", value: "djinni" },
  { label: "Work.ua", value: "work.ua" },
  { label: "Robota.ua", value: "robota.ua" },
  { label: "Google", value: "google" },
  { label: "Company Career page", value: "careerpage" },
  { label: "Other", value: "other" },
];

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe("default job sources", () => {
  it("the list has DOU and Djinni right after LinkedIn, and nothing else for foreign markets", () => {
    expect(JOB_SOURCES.map(({ label, value }) => ({ label, value }))).toEqual(EXPECTED);
  });

  // The creatable picker matches a typed name to a row by canonicalizeEntityValue
  // (job.actions createJobSource): a seeded value that differs would mint a
  // duplicate of the same board the first time a person types it.
  it("the new boards' values are what typing their names resolves to", () => {
    for (const label of ["DOU", "Djinni", "Work.ua", "Robota.ua"]) {
      const source = JOB_SOURCES.find((s) => s.label === label);
      expect(source?.value).toBe(label.toLowerCase());
    }
  });

  it("a new account is seeded with every one of them, brand names as written", async () => {
    const user = await findOrCreateCabinetUser({ userId: 201, role: "student", name: "Тест Джерел" });

    const stored = await prisma.jobSource.findMany({ where: { createdBy: user.id } });
    const byValue = Object.fromEntries(stored.map((s) => [s.value, s.label]));

    expect(stored).toHaveLength(EXPECTED.length);
    expect(byValue).toEqual(Object.fromEntries(EXPECTED.map((s) => [s.value, s.label])));
    expect(byValue.dou).toBe("DOU");
    expect(byValue.djinni).toBe("Djinni");
  });
});
