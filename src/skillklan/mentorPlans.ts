import "server-only";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  type Mentor,
  type MentorStudent,
  getViewerMentor,
  listMentors,
  listMentorStudents,
  listStudentsWithoutMentor,
} from "./cabinetApi";
import { ACCESS_SHARE_MS } from "./accessRecheck";
import { buildPlanTree } from "./plans/tree";

// «Навчальний план» for the admin, the QA moderator and a mentor: mentor → their
// students → a student's plan, view only (D89–D93, D98). Which mentors and
// which students a viewer may see is the backend's answer, asked for the viewer
// whose session this is — never for an id the browser sends (contract:
// docs/contracts/study-plans-mentors.md). Nothing from the backend is stored.

// A list is picked by this: one mentor, or the students without a mentor.
export type MentorEntry = { kind: "mentor"; mentorId: number } | { kind: "none" };

export function parseEntry(raw: unknown): MentorEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as { kind?: unknown; mentorId?: unknown };
  if (e.kind === "none") return { kind: "none" };
  if (e.kind === "mentor" && Number.isSafeInteger(e.mentorId) && (e.mentorId as number) > 0) {
    return { kind: "mentor", mentorId: e.mentorId as number };
  }
  return null;
}

// Calls for the same viewer and the same question within ACCESS_SHARE_MS share
// one answer (the budget in the contract); a failed answer is not kept, so the
// next opening asks again. On globalThis for the same reason as accessRecheck.
type Shared = { startedAt: number; answer: Promise<unknown> };
declare const globalThis: { skillklanSharedMentorLists?: Map<string, Shared> } & typeof global;
const shared = (globalThis.skillklanSharedMentorLists ??= new Map());

export async function sharedAnswer<T>(key: string, ask: () => Promise<T | null>): Promise<T | null> {
  const now = Date.now();
  for (const [k, v] of shared) if (now - v.startedAt >= ACCESS_SHARE_MS) shared.delete(k);
  let entry = shared.get(key);
  if (!entry) {
    entry = { startedAt: now, answer: ask().catch(() => null) };
    shared.set(key, entry);
  }
  const answer = (await entry.answer) as T | null;
  if (answer === null && shared.get(key) === entry) shared.delete(key);
  return answer;
}

// The viewer: the cabinet id of the signed-in person (a dev-only password
// account has none — it sees nothing here).
export async function viewerCabinetId(): Promise<number | null> {
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { cabinetUserId: true } });
  return user?.cabinetUserId ?? null;
}

export type MentorLookup = {
  // The admin and the QA moderator pick a mentor (and «Без ментора»).
  canPick: boolean;
  // `null` — the list could not be loaded.
  mentors: Mentor[] | null;
  // The viewer is a mentor themself.
  me: Mentor | null;
};

export async function loadMentorLookup(viewer: number, canPick: boolean): Promise<MentorLookup> {
  const [me, mentors] = await Promise.all([
    sharedAnswer(`${viewer}:me`, async () => (await getViewerMentor(viewer)) ?? null),
    canPick ? sharedAnswer(`${viewer}:mentors`, () => listMentors(viewer)) : Promise.resolve([] as Mentor[]),
  ]);
  return { canPick, mentors, me };
}

export function loadEntryStudents(viewer: number, entry: MentorEntry): Promise<MentorStudent[] | null> {
  return entry.kind === "none"
    ? sharedAnswer(`${viewer}:none`, () => listStudentsWithoutMentor(viewer))
    : sharedAnswer(`${viewer}:mentor:${entry.mentorId}`, () => listMentorStudents(viewer, entry.mentorId));
}

export type StudentPlans = {
  name: string;
  // The student has no account here yet (never signed in): no plan to show.
  hasAccount: boolean;
  plans: { id: string; track: string; title: string; modules: ReturnType<typeof buildPlanTree> }[];
};

// One student's plans — only if the backend's list for this entry has them.
// The list is asked again (it shares one answer for 30 s), so a changed
// address cannot open the plan of someone who is not theirs.
export async function loadStudentPlans(viewer: number, entry: MentorEntry, studentId: unknown): Promise<StudentPlans | null> {
  if (!Number.isSafeInteger(studentId) || (studentId as number) <= 0) return null;
  const students = await loadEntryStudents(viewer, entry);
  const student = students?.find((s) => s.userId === studentId);
  if (!student) return null;
  const user = await prisma.user.findFirst({ where: { cabinetUserId: student.userId }, select: { id: true } });
  if (!user) return { name: student.name, hasAccount: false, plans: [] };
  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
  return {
    name: student.name,
    hasAccount: true,
    plans: plans.map((p) => ({ id: p.id, track: p.track, title: p.title, modules: buildPlanTree(p.items) })),
  };
}
