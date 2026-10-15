"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { ResponsiveBar } from "@nivo/bar";
import { parseISO } from "date-fns";
import type { AiUsageSummary } from "@/models/aiUsage.model";
import { useFormatDate, useLocale, useTranslations } from "@/i18n/client";
import { DATE_PATTERNS } from "@/i18n/dates";
import {
  FALLBACK_PROVIDER_COLOR,
  PROVIDER_COLORS,
  formatTokens,
  providerLabel,
} from "./format";

export default function DailyTokensChart({
  days,
  providers,
}: Pick<AiUsageSummary, "days" | "providers">) {
  const t = useTranslations("settings.usage");
  const locale = useLocale();
  const formatDate = useFormatDate();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const keys = providers.map((p) => p.provider);
  const data = useMemo(
    () => days.map((d) => ({ day: d.date, ...d.tokensByProvider })),
    [days],
  );
  // About five labels whatever the range, always ending on today.
  const step = Math.max(1, Math.round(days.length / 5));
  const tickValues = days
    .filter((_, i) => i % step === 0 || i === days.length - 1)
    .map((d) => d.date);
  const colorOf = (id: string) =>
    PROVIDER_COLORS[theme][id] ?? FALLBACK_PROVIDER_COLOR;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t("dailyTokens")}</h2>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {keys.map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: colorOf(key) }}
              />
              {providerLabel(key)}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveBar
          data={data}
          keys={keys}
          indexBy="day"
          groupMode="stacked"
          margin={{ top: 8, right: 8, bottom: 28, left: 48 }}
          padding={0.25}
          colors={(bar) => colorOf(String(bar.id))}
          enableLabel={false}
          enableGridY
          axisTop={null}
          axisRight={null}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: 4,
            format: (v) => formatTokens(Number(v), locale),
          }}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickValues,
            format: (v: string) => formatDate(parseISO(v), DATE_PATTERNS.dayMonth),
          }}
          valueFormat={(v) => formatTokens(v, locale)}
          tooltipLabel={(bar) =>
            `${providerLabel(String(bar.id))} · ${formatDate(parseISO(String(bar.indexValue)), DATE_PATTERNS.dayMonth)}`
          }
          theme={{
            text: { fill: "#94A3B8" },
            grid: {
              line: { stroke: theme === "dark" ? "#1E293B" : "#E2E8F0" },
            },
            tooltip: { container: { background: "#1E293B", color: "#FFFFFF" } },
          }}
        />
      </div>
    </section>
  );
}
