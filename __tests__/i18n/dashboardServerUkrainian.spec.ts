// @vitest-environment node
// Requirement — D29: the weekly charts' day labels are built on the server in
// the user's language ("чт, 8 жовт."), and the English defaults the pure
// helpers fall back to are the English dictionary, word for word.
import { getJobsActivityForPeriod } from "@/actions/dashboard.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import { MESSAGES } from "@/i18n/messages";
import { MONTH_SUMMARY_TEXT_EN } from "@/lib/dailyGoals";
import { OTHER_BUCKET_TEXT_EN } from "@/components/dashboard/jobsActivityChart";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@prisma/client", () => {
  const client = { job: { groupBy: vi.fn() } };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

const prisma = new PrismaClient() as any;

describe("weekly chart day labels", () => {
  beforeEach(() => {
    (getCurrentUser as any).mockResolvedValue({ id: "u1" });
    prisma.job.groupBy.mockResolvedValue([]);
  });

  it("Ukrainian: short weekday, day, Ukrainian month", async () => {
    setTestLocale("uk");
    const days: string[] = (await getJobsActivityForPeriod()).map((d: { day: string }) => d.day);
    expect(days).toHaveLength(7);
    for (const day of days) expect(day).toMatch(/^(пн|вт|ср|чт|пт|сб|нд), \d{1,2} [а-яіїєґ.]+$/);
  });

  it("English: unchanged", async () => {
    const days: string[] = (await getJobsActivityForPeriod()).map((d: { day: string }) => d.day);
    for (const day of days) expect(day).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}$/);
  });
});

describe("English defaults match the English dictionary", () => {
  const goals = MESSAGES.en.dashboard.goals;
  it("goal summary", () => {
    expect(MONTH_SUMMARY_TEXT_EN.currentStreak).toBe(goals.currentStreak);
    expect(MONTH_SUMMARY_TEXT_EN.bestStreak).toBe(goals.bestStreak);
    expect(MONTH_SUMMARY_TEXT_EN.bothMet).toBe(goals.bothMet);
    expect(MONTH_SUMMARY_TEXT_EN.nothingLogged).toBe(goals.nothingLogged);
    expect([MONTH_SUMMARY_TEXT_EN.days(1), MONTH_SUMMARY_TEXT_EN.days(3)]).toEqual(["1 day", "3 days"]);
  });
  it("the Other bucket", () => {
    expect(OTHER_BUCKET_TEXT_EN).toEqual({ label: MESSAGES.en.dashboard.other.label, types: MESSAGES.en.dashboard.other.types });
  });
});
