import { revalidatePath } from "next/cache";
import { getTranslations } from "@/i18n/server";
import { confirmCabinetAdmin } from "@/skillklan/cabinetAdmin";
import { isFeatureOff } from "@/skillklan/featureFlags";
import { PLAN_TRACKS } from "./template";
import { SHEET_MAX_BYTES } from "./sheetImport";
import { applyImport, previewImport, type ImportPick, type ImportResult, type Preview } from "./importFlow";

// The two steps of the spreadsheet import, called by POST /api/plans/import (a
// route handler, not a server action: the workbook is bigger than the default
// server-action body limit, and that limit is global — see the route).
type Result<T> = { success: true; data: T } | { success: false; message: string };

async function unavailable() {
  const t = await getTranslations("plans");
  return { success: false, message: t("errors.unavailable") } as const;
}

// Importing students' progress from the school's spreadsheet (SKD-60), for the
// admin: the backend is asked again, now, who the caller is (it writes accounts
// and ticks for other people). The workbook comes with each request and is
// dropped afterwards; the preview writes nothing, and the second call checks
// everything again, so a changed request cannot reach someone the lists lack.
async function importRequest(formData: unknown) {
  const t = await getTranslations("plans");
  if (!(formData instanceof FormData)) return { ok: false, message: t("errors.invalid") } as const;
  const viewer = await confirmCabinetAdmin();
  if (viewer === null) return { ok: false, message: t("errors.adminOnly") } as const;
  const track = formData.get("track");
  const file = formData.get("file");
  if (typeof track !== "string" || !(PLAN_TRACKS as readonly string[]).includes(track)) {
    return { ok: false, message: t("errors.invalid") } as const;
  }
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: t("import.noFile") } as const;
  if (file.size > SHEET_MAX_BYTES) return { ok: false, message: t("import.tooBig") } as const;
  return { ok: true, viewer, track, data: new Uint8Array(await file.arrayBuffer()), formData, t } as const;
}

export async function previewPlanImport(formData: unknown): Promise<Result<Preview>> {
  if (await isFeatureOff("plans")) return unavailable();
  const req = await importRequest(formData);
  if (!req.ok) return { success: false, message: req.message };
  try {
    const preview = await previewImport(req.viewer, req.track, req.data);
    if (preview === null) return { success: false, message: req.t("mentor.listFailed") };
    return { success: true, data: preview };
  } catch (error) {
    console.error("[plans] import preview failed", error);
    return { success: false, message: req.t("import.unreadable") };
  }
}

function picksOf(raw: unknown): ImportPick[] | null {
  if (typeof raw !== "string") return null;
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list) || list.length === 0 || list.length > 200) return null;
    const picks: ImportPick[] = [];
    for (const p of list) {
      const { tab, userId } = (p ?? {}) as { tab?: unknown; userId?: unknown };
      if (typeof tab !== "string" || !Number.isSafeInteger(userId) || (userId as number) <= 0) return null;
      picks.push({ tab, userId: userId as number });
    }
    return picks;
  } catch {
    return null;
  }
}

export async function applyPlanImport(formData: unknown): Promise<Result<{ results: ImportResult[] }>> {
  if (await isFeatureOff("plans")) return unavailable();
  const req = await importRequest(formData);
  if (!req.ok) return { success: false, message: req.message };
  const picks = picksOf(req.formData.get("picks"));
  if (!picks) return { success: false, message: req.t("errors.invalid") };
  try {
    const done = await applyImport(req.viewer, req.track, req.data, picks);
    if (done === "list") return { success: false, message: req.t("mentor.listFailed") };
    if (done === "invalid") return { success: false, message: req.t("errors.invalid") };
    revalidatePath("/dashboard/plan");
    revalidatePath("/dashboard/student-plans");
    return { success: true, data: done };
  } catch (error) {
    console.error("[plans] import failed", error);
    return { success: false, message: req.t("import.unreadable") };
  }
}

// What the route calls: the step the form names.
export async function handleImport(formData: FormData): Promise<Result<Preview> | Result<{ results: ImportResult[] }>> {
  const mode = formData.get("mode");
  if (mode === "preview") return previewPlanImport(formData);
  if (mode === "apply") return applyPlanImport(formData);
  const t = await getTranslations("plans");
  return { success: false, message: t("errors.invalid") };
}
