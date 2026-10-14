import { cn } from "@/lib/utils";
import { AI_USAGE_CONSTANTS } from "@/lib/constants";
import type { AiCallRow } from "@/models/aiUsage.model";
import {
  STATUS_META,
  featureLabel,
  formatCallTime,
  formatCount,
  formatSeconds,
  useUsageText,
} from "./format";

const NUM = "text-right tabular-nums";

export default function RecentCallsTable({ recent }: { recent: AiCallRow[] }) {
  const text = useUsageText();
  const { t, locale } = text;
  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-[15px] font-semibold">{t("recent.title")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("recent.note", {
            limit: AI_USAGE_CONSTANTS.RECENT_LIMIT,
            days: AI_USAGE_CONSTANTS.RETENTION_DAYS,
          })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="flex items-center gap-3 border-b px-5 py-2.5 text-xs font-medium text-muted-foreground">
            <span className="w-[104px]">{t("columns.time")}</span>
            <span className="w-[110px]">{t("columns.feature")}</span>
            <span className="grow">{t("columns.model")}</span>
            <span className={cn("w-[60px]", NUM)}>{t("columns.input")}</span>
            <span className={cn("w-[60px]", NUM)}>{t("columns.output")}</span>
            <span className={cn("w-[68px]", NUM)}>{t("columns.duration")}</span>
            <span className={cn("w-20", NUM)}>{t("columns.firstToken")}</span>
            <span className="w-24 text-right">{t("columns.status")}</span>
          </div>
          {recent.map((r) => {
            const status = STATUS_META[r.status];
            return (
              <div
                key={r.id}
                className="flex h-10 items-center gap-3 border-b px-5 text-[13px] last:border-b-0"
              >
                <span className="w-[104px] tabular-nums text-muted-foreground">
                  {formatCallTime(new Date(r.startedAt), undefined, text)}
                </span>
                <span className="w-[110px]">
                  {featureLabel(r.feature, text)}
                </span>
                <span
                  className="grow truncate font-mono text-xs text-foreground/80"
                  title={r.model}
                >
                  {r.model}
                </span>
                <span className={cn("w-[60px]", NUM)}>
                  {formatCount(r.inputTokens, locale)}
                </span>
                <span className={cn("w-[60px]", NUM)}>
                  {formatCount(r.outputTokens, locale)}
                </span>
                <span className={cn("w-[68px]", NUM)}>
                  {formatSeconds(r.durationMs, text)}
                </span>
                <span className={cn("w-20 text-muted-foreground", NUM)}>
                  {formatSeconds(r.firstTokenMs, text)}
                </span>
                <span className="flex w-24 justify-end">
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-medium",
                      status.className,
                    )}
                  >
                    {t(status.label)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
