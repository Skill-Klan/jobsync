import { cn } from "@/lib/utils";
import type { AiUsageSummary } from "@/models/aiUsage.model";
import {
  formatChange,
  formatDecimal,
  formatSeconds,
  formatTokens,
  useUsageText,
} from "./format";

function StatCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border px-5 py-4">
      <div className="text-[13px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="text-[26px] font-semibold tracking-tight">{value}</div>
      {children}
    </div>
  );
}

export default function UsageSummaryCards({
  totals,
  failuresByStatus,
  rangeDays,
  onShowFailures,
}: Pick<AiUsageSummary, "totals" | "failuresByStatus" | "rangeDays"> & {
  onShowFailures: () => void;
}) {
  const text = useUsageText();
  const { t, locale } = text;
  const change = formatChange(totals.calls, totals.previousCalls);
  const errorRate =
    totals.calls === 0 ? 0 : (totals.failures / totals.calls) * 100;
  const f = failuresByStatus;
  return (
    <div className="grid grid-cols-1 gap-4 @xl/ai-usage:grid-cols-2 @3xl/ai-usage:grid-cols-4">
      <StatCard
        label={t("summary.totalTokens")}
        value={formatTokens(totals.inputTokens + totals.outputTokens, locale)}
      >
        <div className="text-xs text-muted-foreground">
          {t("summary.inputOutput", {
            input: formatDecimal(totals.inputTokens / 1_000_000, 2, locale),
            output: formatDecimal(totals.outputTokens / 1_000_000, 2, locale),
          })}
        </div>
      </StatCard>
      <StatCard label={t("summary.apiCalls")} value={totals.calls.toLocaleString(locale)}>
        {change && (
          <div
            className={cn(
              "text-xs",
              change.up
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground",
            )}
          >
            {t("summary.change", { change: change.text, days: rangeDays })}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {t("summary.chatTurn")}
        </div>
      </StatCard>
      <StatCard
        label={t("summary.medianResponse")}
        value={formatSeconds(totals.medianMs, text)}
      >
        <div className="text-xs text-muted-foreground">
          {`p95 ${formatSeconds(totals.p95Ms, text)}`}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("summary.firstToken", { value: formatSeconds(totals.medianFirstTokenMs, text) })}
        </div>
      </StatCard>
      <StatCard
        label={t("summary.failedCalls")}
        value={totals.failures.toLocaleString(locale)}
      >
        <div className="text-xs text-muted-foreground">
          {t("summary.errorRate", { rate: formatDecimal(errorRate, 1, locale) })}
        </div>
        <button
          type="button"
          onClick={onShowFailures}
          className="w-fit text-left text-xs text-primary hover:underline"
        >
          {t("summary.failureBreakdown", {
            error: String(f.error),
            truncated: String(f.truncated),
            interrupted: String(f.interrupted),
            timedOut: String(f.timed_out),
          })}
        </button>
      </StatCard>
    </div>
  );
}
