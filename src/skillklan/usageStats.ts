import "server-only";
import prisma from "@/lib/db";
import { TICKABLE_KINDS } from "./plans/kinds";

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
  // Study-plan modules over all the person's plans: closed ones (every point in
  // them ticked) out of all.
  modulesClosed: number;
  modulesTotal: number;
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
  withClosedModule: number;
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
  const [jobs, resumes, planItems] = await Promise.all([
    prisma.job.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
    prisma.resume.findMany({
      where: { profile: { userId: { in: ids } } },
      select: { FileId: true, profile: { select: { userId: true } } },
    }),
    prisma.planItem.findMany({
      where: { plan: { userId: { in: ids } } },
      select: { id: true, planId: true, parentId: true, kind: true, done: true },
    }),
  ]);
  const plans = await prisma.plan.findMany({
    where: { userId: { in: ids } },
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
  const modulesClosed = new Map<string, number>();
  const modulesTotal = new Map<string, number>();
  for (const [planId, progress] of moduleProgress(planItems)) {
    const userId = owner.get(planId);
    if (!userId) continue;
    tally(modulesClosed, userId, progress.closed);
    tally(modulesTotal, userId, progress.total);
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
    modulesClosed: modulesClosed.get(u.id) ?? 0,
    modulesTotal: modulesTotal.get(u.id) ?? 0,
  }));
}

type PlanItemLite = { id: string; planId: string; parentId: string | null; kind: string; done: boolean };

// A module is closed when every point in it is ticked (a module with nothing
// to tick is not closed). Per plan: how many modules, how many closed. A point
// is found under its module by walking up the parents; one that sits under no
// module counts nowhere.
export function moduleProgress(items: PlanItemLite[]): Map<string, { closed: number; total: number }> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const tickable: readonly string[] = TICKABLE_KINDS;
  const parts = new Map<string, { done: number; total: number }>();
  const result = new Map<string, { closed: number; total: number }>();
  for (const item of items) {
    if (item.kind !== "module") continue;
    parts.set(item.id, { done: 0, total: 0 });
    const plan = result.get(item.planId) ?? { closed: 0, total: 0 };
    plan.total += 1;
    result.set(item.planId, plan);
  }
  for (const item of items) {
    if (!tickable.includes(item.kind)) continue;
    let up: PlanItemLite | undefined = item;
    for (let depth = 0; up && up.kind !== "module" && depth < 50; depth++) up = up.parentId ? byId.get(up.parentId) : undefined;
    const part = up && up.kind === "module" ? parts.get(up.id) : undefined;
    if (!part) continue;
    part.total += 1;
    if (item.done) part.done += 1;
  }
  for (const item of items) {
    const part = parts.get(item.id);
    if (part && part.total > 0 && part.done === part.total) result.get(item.planId)!.closed += 1;
  }
  return result;
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
    withClosedModule: has((r) => r.modulesClosed),
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
