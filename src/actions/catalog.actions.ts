"use server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "@/i18n/server";
import { getCurrentUser } from "@/utils/user.utils";
import { confirmCabinetAdmin, isAdminSession } from "@/skillklan/cabinetAdmin";
import { isFeatureOff } from "@/skillklan/featureFlags";
import {
  addCatalogEntry,
  approveCatalogRequest,
  listCatalog,
  listPendingRequests,
  materializeCatalogEntry,
  removeCatalogEntry,
  renameCatalogEntry,
  replaceCatalogRequest,
  createOwnValue,
  rejectCatalogRequest,
  type CatalogRequestView,
} from "@/skillklan/catalog/catalog";
import type { CatalogEntryView, PickerOption } from "@/skillklan/catalog/kinds";

type Result<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; message: string };

// The shared catalog (src/skillklan/catalog). Every action refuses while the
// `catalog` switch is off. Changing the catalog asks the backend for the role
// now (confirmCabinetAdmin); a student can only create their own value and pick.
type Reason = "bad_kind" | "bad_label" | "exists" | "not_found";

async function message(key: string) {
  const t = await getTranslations("catalog");
  return t(key as never) as string;
}

async function refused(reason: Reason): Promise<{ success: false; message: string }> {
  const key = { bad_kind: "errors.badKind", bad_label: "errors.badLabel", exists: "errors.exists", not_found: "errors.notFound" }[reason];
  return { success: false, message: await message(key) };
}

const unavailable = async () => ({ success: false, message: await message("errors.unavailable") }) as const;

// The admin's page: the lists and the requests, read for whoever the session
// says manages SkillKlan Job (a change asks the backend again).
export async function getCatalogAdminData(): Promise<Result<{ entries: CatalogEntryView[]; requests: CatalogRequestView[] }>> {
  if (await isFeatureOff("catalog")) return unavailable();
  if (!(await isAdminSession())) return { success: false, message: await message("errors.adminOnly") };
  const [entries, requests] = await Promise.all([listCatalog(), listPendingRequests()]);
  return { success: true, data: { entries, requests } };
}

// Runs a change of the catalog for the admin: the switch, then the role.
async function asAdmin<T>(run: (cabinetUserId: number) => Promise<T>): Promise<T | { success: false; message: string }> {
  if (await isFeatureOff("catalog")) return unavailable();
  const cabinetUserId = await confirmCabinetAdmin();
  if (cabinetUserId === null) return { success: false, message: await message("errors.adminOnly") };
  return run(cabinetUserId);
}

function changed() {
  revalidatePath("/dashboard", "layout");
}

export async function addCatalogItem(kind: unknown, label: unknown): Promise<Result<CatalogEntryView>> {
  return asAdmin(async (admin) => {
    const result = await addCatalogEntry(kind, label, admin);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const, data: result.entry };
  });
}

export async function renameCatalogItem(id: unknown, label: unknown): Promise<Result<CatalogEntryView>> {
  return asAdmin(async () => {
    const result = await renameCatalogEntry(id, label);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const, data: result.entry };
  });
}

export async function removeCatalogItem(id: unknown): Promise<Result> {
  return asAdmin(async () => {
    const result = await removeCatalogEntry(id);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const };
  });
}

export async function approveCatalogItemRequest(id: unknown, label?: unknown): Promise<Result<CatalogEntryView>> {
  return asAdmin(async (admin) => {
    const result = await approveCatalogRequest(id, label, admin);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const, data: result.entry };
  });
}

// The admin replaces the student's value with an entry the catalog has: every
// person's saved jobs, work records and contacts move to it.
export async function replaceCatalogItemRequest(id: unknown, entryId: unknown): Promise<Result<CatalogEntryView>> {
  return asAdmin(async (admin) => {
    const result = await replaceCatalogRequest(id, entryId, admin);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const, data: result.entry };
  });
}

export async function rejectCatalogItemRequest(id: unknown): Promise<Result> {
  return asAdmin(async (admin) => {
    const result = await rejectCatalogRequest(id, admin);
    if (!result.ok) return refused(result.reason);
    changed();
    return { success: true as const };
  });
}

// A student's new value: it is theirs at once, and the admin gets a copy to
// correct or replace (SKD-59).
export async function createCatalogValue(kind: unknown, label: unknown): Promise<Result<PickerOption>> {
  if (await isFeatureOff("catalog")) return unavailable();
  const user = await getCurrentUser();
  if (!user) return { success: false, message: await message("errors.signedOut") };
  const result = await createOwnValue(user.id, kind, label);
  if (!result.ok) return refused(result.reason);
  return { success: true, data: result.row };
}

// The person's own row for a catalog entry they picked (made on the first pick).
export async function pickCatalogItem(entryId: unknown): Promise<Result<PickerOption>> {
  if (await isFeatureOff("catalog")) return unavailable();
  const user = await getCurrentUser();
  if (!user) return { success: false, message: await message("errors.signedOut") };
  const result = await materializeCatalogEntry(user.id, entryId);
  if (!result.ok) return refused(result.reason);
  return { success: true, data: result.row };
}
