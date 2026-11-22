"use server";
import { isAdminSession } from "@/skillklan/cabinetAdmin";
import { byQuietest, collectUsage, summarizeUsage, type UsageRow, type UsageSummary } from "@/skillklan/usageStats";

// «Статистика» (SKD-66): for the admin and the QA moderator only — the session's
// answer is enough to look (it is read-only), as with «Плани студентів». Anyone
// else gets nothing, not an empty page.
export async function getUsageStats(): Promise<{ summary: UsageSummary; people: UsageRow[] } | null> {
  if (!(await isAdminSession())) return null;
  const rows = await collectUsage();
  return { summary: summarizeUsage(rows, new Date()), people: byQuietest(rows) };
}
