"use client";

import { RadialChartComponent } from "@/components/RadialChartSvg";
import { Badge } from "@/components/ui/badge";
import type { JobMatchRecommendation, JobMatchScores } from "@/models/ai.schemas";
import { useLocale, useTranslations } from "@/i18n/client";
import { cn } from "@/lib/utils";

const RECOMMENDATION = {
  "strong match": "strongMatch",
  "good match": "goodMatch",
  "partial match": "partialMatch",
  "weak match": "weakMatch",
} as const satisfies Record<JobMatchRecommendation, string>;

const recommendationVariant = (recommendation: string) =>
  recommendation === "strong match"
    ? "default"
    : recommendation === "good match"
      ? "secondary"
      : recommendation === "partial match"
        ? "outline"
        : "destructive";

// A copy of the retired match sheet's score block, kept here so that surface
// could be deleted without touching this one.
export function AgentMatchScoreCard({
  scores,
  size,
}: {
  scores: JobMatchScores;
  size?: number;
}) {
  const t = useTranslations("agent.scores");
  const locale = useLocale();
  // The model's own word, translated when it is one of the four we asked for.
  const recommendation = scores.recommendation;
  const label = Object.prototype.hasOwnProperty.call(RECOMMENDATION, recommendation)
    ? t(RECOMMENDATION[recommendation])
    : recommendation;
  return (
    <div className="flex flex-col items-center rounded-sm border p-3">
      <RadialChartComponent score={scores.matchScore} size={size} />
      {scores.recommendation && (
        <Badge
          variant={recommendationVariant(scores.recommendation)}
          // English is lower case and capitalised word by word, as before;
          // Ukrainian is already written in sentence case.
          className={cn("mt-2", locale === "en" && "capitalize")}
        >
          {label}
        </Badge>
      )}
    </div>
  );
}
