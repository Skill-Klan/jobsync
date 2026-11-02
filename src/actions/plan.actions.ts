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
    select: { id: true, name: true, cabinetUserId: true, Plan: { select: { track: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return {
    success: true,
    data: {
      students: users.map((u) => ({ id: u.id, name: u.name ?? "", cabinetUserId: u.cabinetUserId, tracks: u.Plan.map((p) => p.track) })),
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
