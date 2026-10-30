// @vitest-environment node
// Requirement — product owner's testing notes: students look for jobs on
// Ukrainian boards, but the default sources had only LinkedIn from them.
//   · every new account starts with "DOU" (value "dou") and "Djinni" (value
//     "djinni"), placed right after LinkedIn, before Monster;
//   · the labels are brand names — kept as written (D29/D30), not translated;
//   · the other defaults stay as they were.
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
  { label: "Indeed", value: "indeed" },
  { label: "Linkedin", value: "linkedin" },
  { label: "DOU", value: "dou" },
  { label: "Djinni", value: "djinni" },
  { label: "Monster", value: "monster" },
  { label: "Glassdoor", value: "glassdoor" },
  { label: "Company Career page", value: "careerpage" },
  { label: "Google", value: "google" },
  { label: "ZipRecruiter", value: "ziprecruiter" },
  { label: "Job Street", value: "jobstreet" },
  { label: "Other", value: "other" },
];

afterAll(async () => {
  await prisma.$disconnect();
  await appPrisma.$disconnect();
  fs.rmSync(ctx.dir, { recursive: true, force: true });
});

describe("default job sources", () => {
  it("the list has DOU and Djinni right after LinkedIn, the rest unchanged", () => {
    expect(JOB_SOURCES.map(({ label, value }) => ({ label, value }))).toEqual(EXPECTED);
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
