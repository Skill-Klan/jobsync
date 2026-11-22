import { isAdminSession } from "@/skillklan/cabinetAdmin";
import { collectUsage, summarizeUsage, type UsageRow, type UsageSummary } from "@/skillklan/usageStats";

// «Статистика» (SKD-66): a plain server module, not a server action — only the
// page calls it, so there is no endpoint a browser can post to. For the admin and
// the QA moderator only. The session's answer is enough: this is a read on a
// render path, where the backend must not be asked every time (CLAUDE.md), and the
// session role is at most 5 minutes old (auth.config). Anyone else gets nothing.
export async function getUsageStats(): Promise<{ summary: UsageSummary; people: UsageRow[] } | null> {
  if (!(await isAdminSession())) return null;
  const rows = await collectUsage();
  return { summary: summarizeUsage(rows, new Date()), people: rows };
}
