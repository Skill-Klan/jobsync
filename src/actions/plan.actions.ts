"use server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getTranslations } from "@/i18n/server";
import { getCurrentUser } from "@/utils/user.utils";
import { confirmCabinetAdmin, isAdminSession } from "@/skillklan/cabinetAdmin";
import { isFeatureOff } from "@/skillklan/featureFlags";
import { assignPlan } from "@/skillklan/plans/assignPlan";
import { PLAN_TRACKS, getPlanTemplate, TICKABLE_KINDS } from "@/skillklan/plans/template";
import { PLAN_NOTE_MAX, buildPlanTree, type PlanItemView } from "@/skillklan/plans/tree";
import type { MentorStudent } from "@/skillklan/cabinetApi";
import {
  type MentorEntry,
  type StudentPlans,
  loadEntryStudents,
  loadStudentPlans,
  parseEntry,
  resolveStudent,
  viewerCabinetId,
} from "@/skillklan/mentorPlans";

type Result<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; message: string };

export interface PlanView {
  id: string;
  track: string;
  title: string;
  modules: PlanItemView[];
}

export interface PlanStudent {
  id: string;
  name: string;
  cabinetUserId: number | null;
  tracks: string[];
  // What taking each plan back would lose, shown before the admin confirms.
  plans: { track: string; done: number; notes: number }[];
}

// The study plan: a student's own copy of a course plan (src/skillklan/plans).
// Every action refuses while the `plans` switch is off, and a student reaches
// only their own plan — the id of someone else's item answers "not found".
async function unavailable() {
  const t = await getTranslations("plans");
  return { success: false, message: t("errors.unavailable") } as const;
}

export async function getMyPlans(): Promise<Result<PlanView[]>> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  const user = await getCurrentUser();
  if (!user) return { success: false, message: t("errors.signedOut") };
  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
  return {
    success: true,
    data: plans.map((p) => ({ id: p.id, track: p.track, title: p.title, modules: buildPlanTree(p.items) })),
  };
}

// A point or a homework task of the person's own plan; nothing else can be
// ticked or annotated.
async function tickableItemOf(userId: string, itemId: unknown) {
  if (typeof itemId !== "string" || itemId === "") return null;
  const item = await prisma.planItem.findFirst({
    where: { id: itemId, plan: { userId } },
    select: { id: true, kind: true },
  });
  return item && TICKABLE_KINDS.includes(item.kind as never) ? item : null;
}

async function ownTickableItem(itemId: unknown) {
  const user = await getCurrentUser();
  return user ? tickableItemOf(user.id, itemId) : null;
}

// Whose plan the viewer writes to: the student of the backend's list for this
// entry, never an id the browser names on its own.
async function viewedStudentItem(entry: unknown, studentId: unknown, itemId: unknown) {
  const who = await mentorViewer();
  if (!who.ok) return { ok: false, message: who.message } as const;
  const parsed = parseEntry(entry);
  if (!parsed) return { ok: false, message: who.t("errors.invalid") } as const;
  const student = await resolveStudent(who.viewer, parsed, studentId);
  const item = student?.userId ? await tickableItemOf(student.userId, itemId) : null;
  return item ? ({ ok: true, item, t: who.t } as const) : ({ ok: false, message: who.t("errors.notFound") } as const);
}

async function writeDone(itemId: string, done: boolean, t: Awaited<ReturnType<typeof getTranslations>>): Promise<Result> {
  try {
    await prisma.planItem.update({ where: { id: itemId }, data: { done, doneAt: done ? new Date() : null } });
  } catch (error) {
    console.error("[plans] tick failed", error);
    return { success: false, message: t("errors.saveFailed") };
  }
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/student-plans");
  return { success: true };
}

export async function setPlanItemDone(itemId: unknown, done: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof done !== "boolean") return { success: false, message: t("errors.invalid") };
  const item = await ownTickableItem(itemId);
  if (!item) return { success: false, message: t("errors.notFound") };
  return writeDone(item.id, done, t);
}

// A note: text up to the limit, trimmed; empty clears it. Returns the text to
// store, or the refusal.
async function checkedNote(note: unknown) {
  const t = await getTranslations("plans");
  if (typeof note !== "string" || note.length > PLAN_NOTE_MAX * 2) {
    return { ok: false, message: t("errors.invalid") } as const;
  }
  const text = note.trim();
  if (text.length > PLAN_NOTE_MAX) return { ok: false, message: t("errors.noteTooLong", { max: PLAN_NOTE_MAX }) } as const;
  return { ok: true, value: text === "" ? null : text, t } as const;
}

async function writeNote(itemId: string, value: string | null, t: Awaited<ReturnType<typeof getTranslations>>): Promise<Result> {
  try {
    await prisma.planItem.update({ where: { id: itemId }, data: { note: value } });
  } catch (error) {
    console.error("[plans] note failed", error);
    return { success: false, message: t("errors.saveFailed") };
  }
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/student-plans");
  return { success: true };
}

// An empty note clears it.
export async function setPlanItemNote(itemId: unknown, note: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const checked = await checkedNote(note);
  if (!checked.ok) return { success: false, message: checked.message };
  const item = await ownTickableItem(itemId);
  if (!item) return { success: false, message: checked.t("errors.notFound") };
  return writeNote(item.id, checked.value, checked.t);
}

// «Плани студентів»: who has which plan. For the admin and the QA moderator —
// the session's answer is enough to look, as with the Settings page.
export async function listPlanStudents(): Promise<Result<{ students: PlanStudent[]; tracks: { track: string; title: string }[] }>> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (!(await isAdminSession())) return { success: false, message: t("errors.adminOnly") };
  const users = await prisma.user.findMany({
    select: { id: true, name: true, cabinetUserId: true, Plan: { select: { id: true, track: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const count = async (where: { done: true } | { note: { not: null } }) =>
    new Map(
      (await prisma.planItem.groupBy({ by: ["planId"], where, _count: { _all: true } })).map((g) => [g.planId, g._count._all]),
    );
  const [done, notes] = await Promise.all([count({ done: true }), count({ note: { not: null } })]);
  return {
    success: true,
    data: {
      students: users.map((u) => ({ id: u.id, name: u.name ?? "", cabinetUserId: u.cabinetUserId, tracks: u.Plan.map((p) => p.track),
        plans: u.Plan.map((p) => ({ track: p.track, done: done.get(p.id) ?? 0, notes: notes.get(p.id) ?? 0 })),
      })),
      tracks: PLAN_TRACKS.map((track) => ({ track, title: getPlanTemplate(track)!.title })),
    },
  };
}

// Giving a plan changes a student's account: the backend is asked again, now
// (skillklan/cabinetAdmin.ts), not only the session.
export async function assignStudentPlan(userId: unknown, track: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof userId !== "string" || typeof track !== "string") return { success: false, message: t("errors.invalid") };
  if (!(await confirmCabinetAdmin())) return { success: false, message: t("errors.adminOnly") };
  const result = await assignPlan(prisma, userId, track);
  if (!result.ok) return { success: false, message: t(`assign.${result.reason}`) };
  revalidatePath("/dashboard/student-plans");
  return { success: true };
}

// Takes a plan back — a mistaken one, or a graduate's. The copy goes with its
// ticks and notes (the items follow it), and the same plan can be given again.
// Like giving one: the backend is asked now.
export async function removeStudentPlan(userId: unknown, track: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof userId !== "string" || typeof track !== "string") return { success: false, message: t("errors.invalid") };
  if (!(await confirmCabinetAdmin())) return { success: false, message: t("errors.adminOnly") };
  const { count } = await prisma.plan.deleteMany({ where: { userId, track } });
  if (count === 0) return { success: false, message: t("remove.notFound") };
  revalidatePath("/dashboard/student-plans");
  revalidatePath("/dashboard/plan");
  return { success: true };
}

// The mentor path (D89–D93, D98): mentor → their students → a student's plan,
// which the viewer may tick and annotate like the student (the student's own
// fields, no author kept). Who is on a list is the backend's answer for the signed-in
// person; the entry and the id come from the browser, the viewer never does.
async function mentorViewer() {
  const t = await getTranslations("plans");
  const viewer = await viewerCabinetId();
  return viewer === null ? ({ ok: false, message: t("errors.signedOut") } as const) : ({ ok: true, viewer, t } as const);
}

export async function getEntryStudents(entry: unknown): Promise<Result<{ students: MentorStudent[] }>> {
  if (await isFeatureOff("plans")) return unavailable();
  const who = await mentorViewer();
  if (!who.ok) return { success: false, message: who.message };
  const parsed = parseEntry(entry);
  if (!parsed) return { success: false, message: who.t("errors.invalid") };
  const students = await loadEntryStudents(who.viewer, parsed);
  if (students === null) return { success: false, message: who.t("mentor.listFailed") };
  return { success: true, data: { students } };
}

export async function getStudentPlans(entry: unknown, studentId: unknown): Promise<Result<StudentPlans>> {
  if (await isFeatureOff("plans")) return unavailable();
  const who = await mentorViewer();
  if (!who.ok) return { success: false, message: who.message };
  const parsed = parseEntry(entry);
  if (!parsed) return { success: false, message: who.t("errors.invalid") };
  const plans = await loadStudentPlans(who.viewer, parsed, studentId);
  if (!plans) return { success: false, message: who.t("mentor.studentNotAvailable") };
  return { success: true, data: plans };
}

export async function setStudentPlanItemDone(entry: unknown, studentId: unknown, itemId: unknown, done: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof done !== "boolean") return { success: false, message: t("errors.invalid") };
  const target = await viewedStudentItem(entry, studentId, itemId);
  if (!target.ok) return { success: false, message: target.message };
  return writeDone(target.item.id, done, target.t);
}

export async function setStudentPlanItemNote(entry: unknown, studentId: unknown, itemId: unknown, note: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const checked = await checkedNote(note);
  if (!checked.ok) return { success: false, message: checked.message };
  const target = await viewedStudentItem(entry, studentId, itemId);
  if (!target.ok) return { success: false, message: target.message };
  return writeNote(target.item.id, checked.value, target.t);
}
