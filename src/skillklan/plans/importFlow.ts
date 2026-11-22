import "server-only";
import prisma from "@/lib/db";
import { ensureCabinetUser } from "../cabinetUser";
import { listMentors, listMentorStudents, listStudentsWithoutMentor, type MentorStudent } from "../cabinetApi";
import { sharedAnswer } from "../mentorPlans";
import { importTabIntoPlan, planPoints } from "./importPlan";
import { matchPassed, readStudentTabs, type PassedRow, type StudentTab } from "./sheetImport";
import { getPlanTemplate } from "./template";

// Importing the progress of students from the school's spreadsheet (Jira SKD-60).
// An admin sends the workbook; each student tab is offered a student from the
// backend's lists (the same lists «Плани студентів» shows — the backend decides
// who exists and whose student they are), and after the admin's confirmation the
// student gets an account without signing in, their plan, and the passed points
// ticked. The file is read and dropped: nothing of it is stored.

export type PoolStudent = { userId: number; name: string; mentors: string[] };

// Everyone the viewer may see: all mentors' students and those without a
// mentor, each once. `null` when any list could not be loaded — a partial pool
// would offer wrong matches without saying so.
export async function loadStudentPool(viewer: number): Promise<PoolStudent[] | null> {
  const mentors = await sharedAnswer(`${viewer}:mentors`, () => listMentors(viewer));
  if (mentors === null) return null;
  const lists: { mentor: string | null; students: MentorStudent[] | null }[] = [];
  const jobs: (() => Promise<void>)[] = [
    ...mentors.map((m) => async () => {
      lists.push({ mentor: m.name, students: await sharedAnswer(`${viewer}:mentor:${m.mentorId}`, () => listMentorStudents(viewer, m.mentorId)) });
    }),
    async () => {
      lists.push({ mentor: null, students: await sharedAnswer(`${viewer}:none`, () => listStudentsWithoutMentor(viewer)) });
    },
  ];
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((job) => job()));
  const pool = new Map<number, PoolStudent>();
  for (const { mentor, students } of lists) {
    if (students === null) return null;
    for (const s of students) {
      const known = pool.get(s.userId) ?? { userId: s.userId, name: s.name, mentors: [] };
      if (mentor && !known.mentors.includes(mentor)) known.mentors.push(mentor);
      pool.set(s.userId, known);
    }
  }
  return [...pool.values()];
}

const lower = (s: string) => s.toLocaleLowerCase("uk").trim();
const tokens = (s: string) => lower(s).split(/\s+/).filter(Boolean);

// The students a tab may belong to: the tab's first name is one of their name's
// words. When several share it, the bracket of the tab («Борис») may point at
// the mentor — if that leaves exactly one, it is preselected; otherwise the
// admin chooses.
export function candidatesFor(tab: Pick<StudentTab, "firstName" | "hint">, pool: PoolStudent[]) {
  const first = lower(tab.firstName);
  const candidates = pool.filter((s) => tokens(s.name).includes(first));
  let preselected: number | null = candidates.length === 1 ? candidates[0].userId : null;
  if (candidates.length > 1 && tab.hint) {
    const byMentor = candidates.filter((s) => s.mentors.some((m) => tokens(m)[0] === lower(tab.hint)));
    if (byMentor.length === 1) preselected = byMentor[0].userId;
  }
  return { candidates, preselected };
}

export type PreviewTab = {
  tab: string;
  passed: number;
  candidates: PoolStudent[];
  preselected: number | null;
  // What the student has now.
  account: boolean;
  plan: boolean;
  // Passed rows that would find no point in the plan (for a student who has
  // none yet: in the template).
  missing: PassedRow[];
  willMark: number;
  alreadyDone: number;
};

export type Preview = { tabs: PreviewTab[]; skipped: { tab: string; reason: "noProgress" }[] };

async function planOf(cabinetUserId: number, track: string) {
  const user = await prisma.user.findUnique({ where: { cabinetUserId }, select: { id: true } });
  const plan = user ? await prisma.plan.findUnique({ where: { userId_track: { userId: user.id, track } }, select: { id: true } }) : null;
  return { user, plan };
}

// What this tab would do to this student: counted against their plan when they
// have one, against the template when they do not. Nothing is written.
async function wouldDo(tab: StudentTab, track: string, cabinetUserId: number | null) {
  const have = cabinetUserId === null ? null : await planOf(cabinetUserId, track);
  if (have?.plan) return { account: true, plan: true, ...matchPassed(await planPoints(prisma, have.plan.id), tab.rows) };
  const template = getPlanTemplate(track);
  const points: { id: string; topic: string; text: string; done: boolean }[] = [];
  const walk = (nodes: NonNullable<typeof template>["children"], topic: string) => {
    for (const n of nodes) {
      if (n.kind === "item") points.push({ id: `${points.length}`, topic, text: n.title, done: false });
      walk(n.children ?? [], n.kind === "topic" ? n.title : topic);
    }
  };
  if (template) walk(template.children, "");
  return { account: Boolean(have?.user), plan: false, ...matchPassed(points, tab.rows) };
}

export async function previewImport(viewer: number, track: string, data: Uint8Array): Promise<Preview | null> {
  const pool = await loadStudentPool(viewer);
  if (pool === null) return null;
  const tabs = await readStudentTabs(data);
  const out: Preview = { tabs: [], skipped: [] };
  for (const tab of tabs) {
    const passed = tab.rows.filter((r) => r.passed).length;
    if (passed === 0) {
      out.skipped.push({ tab: tab.name, reason: "noProgress" });
      continue;
    }
    const { candidates, preselected } = candidatesFor(tab, pool);
    const doing = await wouldDo(tab, track, preselected);
    out.tabs.push({
      tab: tab.name,
      passed,
      candidates,
      preselected,
      account: doing.account,
      plan: doing.plan,
      missing: doing.missing,
      willMark: doing.ids.length,
      alreadyDone: doing.alreadyDone,
    });
  }
  return out;
}

export type ImportPick = { tab: string; userId: number };
export type ImportResult = {
  tab: string;
  name: string;
  ok: boolean;
  accountCreated: boolean;
  planCreated: boolean;
  marked: number;
  alreadyDone: number;
  missing: number;
};

// Writes what the admin confirmed. Every pick is checked again: the tab must be
// in the file and have progress, the student must be in the backend's pool, and
// a student or a tab may be picked once. One student failing does not stop the
// others; the result says which went through.
export async function applyImport(
  viewer: number,
  track: string,
  data: Uint8Array,
  picks: ImportPick[],
): Promise<{ results: ImportResult[] } | "list" | "invalid"> {
  const pool = await loadStudentPool(viewer);
  if (pool === null) return "list";
  const tabs = new Map((await readStudentTabs(data)).map((t) => [t.name, t]));
  const seenTabs = new Set<string>();
  const seenStudents = new Set<number>();
  const work: { tab: StudentTab; student: PoolStudent }[] = [];
  for (const pick of picks) {
    const tab = tabs.get(pick.tab);
    const student = pool.find((s) => s.userId === pick.userId);
    if (!tab || !student || seenTabs.has(pick.tab) || seenStudents.has(pick.userId) || !tab.rows.some((r) => r.passed)) return "invalid";
    seenTabs.add(pick.tab);
    seenStudents.add(pick.userId);
    work.push({ tab, student });
  }
  const results: ImportResult[] = [];
  for (const { tab, student } of work) {
    const base = { tab: tab.name, name: student.name, accountCreated: false, planCreated: false, marked: 0, alreadyDone: 0, missing: 0 };
    try {
      const account = await ensureCabinetUser({ userId: student.userId, name: student.name });
      const done = await importTabIntoPlan(prisma, account.id, track, tab);
      results.push({ ...base, ok: true, accountCreated: account.created, planCreated: done.planCreated, marked: done.marked, alreadyDone: done.alreadyDone, missing: done.missing.length });
    } catch (error) {
      console.error("[plans] import failed", error);
      results.push({ ...base, ok: false });
    }
  }
  return { results };
}
