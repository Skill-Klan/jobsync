import "server-only";
import prisma from "@/lib/db";

// What the SkillKlan admin sees about each person's use of SkillKlan Job
// (owner decisions D42, D46 — numbers for everyone with access, list first).
// The backend asks for these over the machine API (skillklan/adminApi.ts) and
// joins them with its own people by cabinetUserId: names, roles and access
// live there, not here. Numbers only — no job titles, companies, notes or
// resume text cross the boundary in this call.
//
// One query per model for everyone at once (groupBy / a narrow select),
// never a query per person: the admin list covers every student.
//
// Definitions — the same ones the app shows the student:
//   · applied      — jobs marked applied (Job.applied), whatever their status now;
//   · byStatus     — jobs per current status value (draft, applied, interview,
//                    offer, offer-accepted, …);
//   · interviews   — timeline stages whose type belongs to the "interview"
//                    status, exactly the rows of the Interviews page
//                    (actions/interview.actions.ts);
//   · automations  — job-search automations, and how many are active (not paused).

export type UserStats = {
  cabinetUserId: number;
  firstLoginAt: string;
  lastLoginAt: string | null;
  jobs: { total: number; applied: number; byStatus: Record<string, number> };
  interviews: number;
  resumes: number;
  coverLetters: number;
  automations: { total: number; active: number };
  tasks: number;
  activities: number;
  contacts: number;
  questions: number;
};

const INTERVIEW_STATUS = "interview";
const ACTIVE_AUTOMATION = "active";

function counter() {
  const counts = new Map<string, number>();
  return {
    add(key: string, n = 1) {
      counts.set(key, (counts.get(key) ?? 0) + n);
    },
    get(key: string) {
      return counts.get(key) ?? 0;
    },
  };
}

/**
 * Stats for people who came in from the cabinet. Without `cabinetUserIds` —
 * everyone; with — just those (a person who never came in is simply absent).
 */
export async function collectUserStats(cabinetUserIds?: number[]): Promise<UserStats[]> {
  const users = await prisma.user.findMany({
    where: { cabinetUserId: cabinetUserIds ? { in: cabinetUserIds } : { not: null } },
    select: { id: true, cabinetUserId: true, createdAt: true, lastLoginAt: true },
    orderBy: { cabinetUserId: "asc" },
  });
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const mine = { in: ids };

  const [
    statuses,
    jobsByStatus,
    applied,
    interviewStages,
    resumes,
    coverLetters,
    automations,
    tasks,
    activities,
    contacts,
    questions,
  ] = await Promise.all([
    prisma.jobStatus.findMany({ select: { id: true, value: true } }),
    prisma.job.groupBy({ by: ["userId", "statusId"], where: { userId: mine }, _count: { _all: true } }),
    prisma.job.groupBy({ by: ["userId"], where: { userId: mine, applied: true }, _count: { _all: true } }),
    prisma.jobStage.findMany({
      where: { Job: { userId: mine }, StageType: { Status: { value: INTERVIEW_STATUS } } },
      select: { Job: { select: { userId: true } } },
    }),
    prisma.resume.findMany({ where: { profile: { userId: mine } }, select: { profile: { select: { userId: true } } } }),
    prisma.coverLetter.findMany({ where: { profile: { userId: mine } }, select: { profile: { select: { userId: true } } } }),
    prisma.automation.groupBy({ by: ["userId", "status"], where: { userId: mine }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["userId"], where: { userId: mine }, _count: { _all: true } }),
    prisma.activity.groupBy({ by: ["userId"], where: { userId: mine }, _count: { _all: true } }),
    prisma.contact.groupBy({ by: ["createdBy"], where: { createdBy: mine }, _count: { _all: true } }),
    prisma.question.groupBy({ by: ["createdBy"], where: { createdBy: mine }, _count: { _all: true } }),
  ]);

  const statusValue = new Map(statuses.map((s) => [s.id, s.value]));
  const byStatus = new Map<string, Record<string, number>>();
  const jobsTotal = counter();
  for (const row of jobsByStatus) {
    const value = statusValue.get(row.statusId) ?? "unknown";
    const own = byStatus.get(row.userId) ?? {};
    own[value] = (own[value] ?? 0) + row._count._all;
    byStatus.set(row.userId, own);
    jobsTotal.add(row.userId, row._count._all);
  }

  const appliedCount = counter();
  for (const row of applied) appliedCount.add(row.userId, row._count._all);

  const interviewCount = counter();
  for (const stage of interviewStages) interviewCount.add(stage.Job.userId);

  const resumeCount = counter();
  for (const r of resumes) resumeCount.add(r.profile.userId);
  const letterCount = counter();
  for (const c of coverLetters) letterCount.add(c.profile.userId);

  const automationTotal = counter();
  const automationActive = counter();
  for (const row of automations) {
    automationTotal.add(row.userId, row._count._all);
    if (row.status === ACTIVE_AUTOMATION) automationActive.add(row.userId, row._count._all);
  }

  const taskCount = counter();
  for (const row of tasks) taskCount.add(row.userId, row._count._all);
  const activityCount = counter();
  for (const row of activities) activityCount.add(row.userId, row._count._all);
  const contactCount = counter();
  for (const row of contacts) contactCount.add(row.createdBy, row._count._all);
  const questionCount = counter();
  for (const row of questions) questionCount.add(row.createdBy, row._count._all);

  return users.map((u) => ({
    cabinetUserId: u.cabinetUserId as number,
    firstLoginAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    jobs: {
      total: jobsTotal.get(u.id),
      applied: appliedCount.get(u.id),
      byStatus: byStatus.get(u.id) ?? {},
    },
    interviews: interviewCount.get(u.id),
    resumes: resumeCount.get(u.id),
    coverLetters: letterCount.get(u.id),
    automations: { total: automationTotal.get(u.id), active: automationActive.get(u.id) },
    tasks: taskCount.get(u.id),
    activities: activityCount.get(u.id),
    contacts: contactCount.get(u.id),
    questions: questionCount.get(u.id),
  }));
}

/**
 * Accounts with no cabinet person behind them. Only the dev-only password
 * login makes those, so in production this should be 0 — the admin sees the
 * number instead of such accounts silently missing from the list.
 */
export async function countUnlinkedAccounts(): Promise<number> {
  return prisma.user.count({ where: { cabinetUserId: null } });
}
