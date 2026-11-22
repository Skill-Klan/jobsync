import { getTranslations } from "@/i18n/server";
import { isFeatureOff } from "@/skillklan/featureFlags";

// Not a "use server" module: a helper for the task actions, not an endpoint.
//
// Tasks switched off (Settings → «Функції»): a page opened before the switch
// went off still has its buttons, so every action that changes a task refuses
// here. `null` — the switch is on, go on.
export async function refuseIfTasksOff(): Promise<{ success: false; message: string } | null> {
  if (!(await isFeatureOff("tasks"))) return null;
  const t = await getTranslations("tasks");
  return { success: false, message: t("errors.switchedOff") };
}
