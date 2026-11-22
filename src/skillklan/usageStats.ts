import "server-only";
import prisma from "@/lib/db";

// «Статистика» for the admin (SKD-66, level 1): who signs in and what each
// person has made, counted from what the app already stores — no event log.
// Only people with a cabinet account (cabinetUserId): dev-only password
// accounts are not people of the school. Roles are the backend's, not kept
// here, so the staff who signed in (admin, mentors) are among the people;
// a student who never had an account is not here at all.
//
// "Signed in" is lastLoginAt — the last sign-in from the cabinet, not "last
// seen": the session slides (8 h from the last request), so someone who works
// every day may not sign in again for days.

export type UsageRow = {
  id: string;
  name: string;
  cabinetUserId: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  jobs: number;
  resumes: number;
  resumesWithFile: number;
  planDone: number;
};

export type UsageSummary = {
  people: number;
  signedIn: number;
  neverSignedIn: number;
  active7: number;
  active30: number;
  // How many people have at least one of each.
  withJobs: number;
  withResume: number;
  withResumeFile: number;
  withPlanProgress: number;
  medianJobs: number;
};

const DAY = 24 * 60 * 60 * 1000;

const counts = <T extends { userId: string; _count: { _all: number } }>(groups: T[]) =>
  new Map(groups.map((g) => [g.userId, g._count._all]));

export async function collectUsage(): Promise<UsageRow[]> {
  const users = await prisma.user.findMany({
    where: { cabinetUserId: { not: null } },
    select: { id: true, name: true, cabinetUserId: true, createdAt: true, lastLoginAt: true },
  });
  const ids = users.map((u) => u.id);
  const [jobs, resumes, planDone] = await Promise.all([
    prisma.job.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.resume.findMany({
      where: { profile: { userId: { in: ids } } },
      select: { FileId: true, profile: { select: { userId: true } } },
    }),
    prisma.planItem.groupBy({
      by: ["planId"],
      where: { done: true, plan: { userId: { in: ids } } },
      _count: { _all: true },
    }),
  ]);
  const plans = await prisma.plan.findMany({
    where: { id: { in: planDone.map((g) => g.planId) } },
    select: { id: true, userId: true },
  });
  const owner = new Map(plans.map((p) => [p.id, p.userId]));
  const tally = (map: Map<string, number>, userId: string, by = 1) => map.set(userId, (map.get(userId) ?? 0) + by);

  const jobCount = counts(jobs);
  const resumeCount = new Map<string, number>();
  const resumeFileCount = new Map<string, number>();
  for (const r of resumes) {
    tally(resumeCount, r.profile.userId);
    if (r.FileId) tally(resumeFileCount, r.profile.userId);
  }
  const planCount = new Map<string, number>();
  for (const g of planDone) {
    const userId = owner.get(g.planId);
    if (userId) tally(planCount, userId, g._count._all);
  }

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    cabinetUserId: u.cabinetUserId as number,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    jobs: jobCount.get(u.id) ?? 0,
    resumes: resumeCount.get(u.id) ?? 0,
    resumesWithFile: resumeFileCount.get(u.id) ?? 0,
    planDone: planCount.get(u.id) ?? 0,
  }));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeUsage(rows: UsageRow[], now: Date): UsageSummary {
  const since = (days: number) => now.getTime() - days * DAY;
  const has = (pick: (r: UsageRow) => number) => rows.filter((r) => pick(r) > 0).length;
  const signedIn = rows.filter((r) => r.lastLoginAt !== null).length;
  const within = (days: number) =>
    rows.filter((r) => r.lastLoginAt !== null && r.lastLoginAt.getTime() >= since(days)).length;
  return {
    people: rows.length,
    signedIn,
    neverSignedIn: rows.length - signedIn,
    active7: within(7),
    active30: within(30),
    withJobs: has((r) => r.jobs),
    withResume: has((r) => r.resumes),
    withResumeFile: has((r) => r.resumesWithFile),
    withPlanProgress: has((r) => r.planDone),
    medianJobs: median(rows.map((r) => r.jobs)),
  };
}

// Who to look at first: the longest quiet on top (never signed in, then the
// oldest sign-in), so "who fell asleep" is the head of the list.
export function byQuietest(rows: UsageRow[]): UsageRow[] {
  return [...rows].sort((a, b) => {
    const x = a.lastLoginAt?.getTime() ?? -Infinity;
    const y = b.lastLoginAt?.getTime() ?? -Infinity;
    return x - y || a.name.localeCompare(b.name, "uk");
  });
}
