import { notFound } from "next/navigation";
import UsageStats from "@/components/stats/UsageStats";
import { getUsageStats } from "@/actions/usageStats.actions";
import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";

// The tab title: the page's name (the layout adds «| SkillKlan Job»).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("stats") };
}

// The admin's page (SKD-66): for the admin and the QA moderator. For anyone
// else it does not exist — a 404, as for «Плани студентів».
async function Stats() {
  const stats = await getUsageStats();
  if (!stats) notFound();
  return (
    <div className="col-span-3">
      <UsageStats summary={stats.summary} people={stats.people} />
    </div>
  );
}

export default Stats;
