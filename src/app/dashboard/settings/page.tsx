import SettingsView from "@/components/settings/SettingsView";
import { isAdminSession } from "@/skillklan/cabinetAdmin";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";

// The tab title: the page's name (the layout adds «| SkillKlan Job»).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("settings") };
}

// «Функції» (the SkillKlan feature switches) is for admins only: everyone else
// gets no section and no switch values at all — not a hidden one.
export default async function SettingsPage() {
  const features = (await isAdminSession()) ? await getFeatureFlags() : null;
  return <SettingsView features={features} />;
}
