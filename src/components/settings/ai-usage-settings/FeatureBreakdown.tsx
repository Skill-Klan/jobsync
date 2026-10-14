import type { AiUsageSummary } from "@/models/aiUsage.model";
import { featureLabel, formatSeconds, formatTokens, useUsageText } from "./format";

export default function FeatureBreakdown({
  features,
}: Pick<AiUsageSummary, "features">) {
  const text = useUsageText();
  const { t, locale } = text;
  const maxTokens = Math.max(1, ...features.map((f) => f.tokens));
  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-[15px] font-semibold">{t("byFeature.title")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("byFeature.columns")}
        </span>
      </div>
      <div className="py-1.5">
        {features.map((f) => (
          <div
            key={f.feature}
            className="flex items-center gap-2.5 px-5 py-2 text-[13px]"
          >
            <span className="w-[110px] shrink-0">
              {featureLabel(f.feature, text)}
            </span>
            <span className="block h-1.5 grow overflow-hidden rounded-full bg-muted">
              <span
                className="block h-1.5 bg-teal-500"
                style={{ width: `${(f.tokens / maxTokens) * 100}%` }}
              />
            </span>
            <span className="w-[52px] text-right font-medium tabular-nums">
              {formatTokens(f.tokens, locale)}
            </span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">
              {f.calls.toLocaleString(locale)}
            </span>
            <span className="w-11 text-right tabular-nums text-muted-foreground">
              {formatSeconds(f.medianMs, text)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
