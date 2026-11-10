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
async function ownTickableItem(itemId: unknown) {
  const user = await getCurrentUser();
  if (!user || typeof itemId !== "string" || itemId === "") return null;
  const item = await prisma.planItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { id: true, kind: true },
  });
  return item && TICKABLE_KINDS.includes(item.kind as never) ? item : null;
}

export async function setPlanItemDone(itemId: unknown, done: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof done !== "boolean") return { success: false, message: t("errors.invalid") };
  const item = await ownTickableItem(itemId);
  if (!item) return { success: false, message: t("errors.notFound") };
  try {
    await prisma.planItem.update({ where: { id: item.id }, data: { done, doneAt: done ? new Date() : null } });
  } catch (error) {
    console.error("[plans] tick failed", error);
    return { success: false, message: t("errors.saveFailed") };
  }
  revalidatePath("/dashboard/plan");
  return { success: true };
}

// An empty note clears it.
export async function setPlanItemNote(itemId: unknown, note: unknown): Promise<Result> {
  if (await isFeatureOff("plans")) return unavailable();
  const t = await getTranslations("plans");
  if (typeof note !== "string" || note.length > PLAN_NOTE_MAX * 2) {
    return { success: false, message: t("errors.invalid") };
  }
  const text = note.trim();
  if (text.length > PLAN_NOTE_MAX) return { success: false, message: t("errors.noteTooLong", { max: PLAN_NOTE_MAX }) };
  const item = await ownTickableItem(itemId);
  if (!item) return { success: false, message: t("errors.notFound") };
  try {
    await prisma.planItem.update({ where: { id: item.id }, data: { note: text === "" ? null : text } });
  } catch (error) {
    console.error("[plans] note failed", error);
    return { success: false, message: t("errors.saveFailed") };
  }
  revalidatePath("/dashboard/plan");
  return { success: true };
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
// view only. Who is on a list is the backend's answer for the signed-in
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
