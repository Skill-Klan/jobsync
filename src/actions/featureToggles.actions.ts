"use server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getTranslations } from "@/i18n/server";
import { confirmCabinetAdmin } from "@/skillklan/cabinetAdmin";
import { readFeatureFlags } from "@/skillklan/featureFlags";
import { type FeatureFlags, isFeatureKey } from "@/skillklan/features";

type Result = { success: true; data: FeatureFlags } | { success: false; message: string };

// Settings → «Функції»: turn a part of SkillKlan Job on or off for everyone.
// Only an admin, confirmed by the backend at this very moment
// (skillklan/cabinetAdmin.ts) — the button is hidden from everyone else, but a
// server action can be called without the button.
export async function setFeatureEnabled(key: unknown, enabled: unknown): Promise<Result> {
  const t = await getTranslations("settings");
  if (!isFeatureKey(key) || typeof enabled !== "boolean") {
    return { success: false, message: t("features.invalid") };
  }
  const adminId = await confirmCabinetAdmin();
  if (!adminId) return { success: false, message: t("features.adminOnly") };
  try {
    await prisma.featureToggle.upsert({
      where: { key },
      create: { key, enabled, updatedByCabinetUserId: adminId },
      update: { enabled, updatedByCabinetUserId: adminId },
    });
  } catch (error) {
    console.error("[featureToggles] save failed", error);
    return { success: false, message: t("features.saveFailed") };
  }
  // The menu and every dashboard page read the switches on render.
  revalidatePath("/dashboard", "layout");
  return { success: true, data: await readFeatureFlags() };
}
