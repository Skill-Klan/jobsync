"use client";

import { useMemo } from "react";
import Link from "next/link";
import MarkdownIt from "markdown-it";
import { Badge } from "@/components/ui/badge";
import { TipTapContentViewer } from "@/components/TipTapContentViewer";
import type { JobMatchData } from "@/models/ai.schemas";
import { cn } from "@/lib/utils";
import { useFormatDate, useLocale, useTranslations } from "@/i18n/client";
import { AUTOMATION_DATE_PATTERNS } from "./datePatterns";

// The AI's verdict is stored in English; known values are shown in the
// user's language, anything else as stored.
const RECOMMENDATION_KEYS = {
  "strong match": "strong",
  "good match": "good",
  "partial match": "partial",
  "weak match": "weak",
} as const;
type RecommendationKey =
  (typeof RECOMMENDATION_KEYS)[keyof typeof RECOMMENDATION_KEYS];
function recommendationKey(value: string): RecommendationKey | null {
  return Object.prototype.hasOwnProperty.call(RECOMMENDATION_KEYS, value)
    ? RECOMMENDATION_KEYS[value as keyof typeof RECOMMENDATION_KEYS]
    : null;
}

// html:false escapes any raw HTML in the model output; TipTapContentViewer
// further strips unrecognized tags, so the rendered analysis is safe.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Legacy matches saved before the markdown refactor have a structured `summary`
// instead of a `body`. Show what we can rather than rendering blank.
interface LegacyMatchData {
  summary?: string;
}

interface MatchDetailsProps {
  matchData: (JobMatchData & LegacyMatchData) | null;
  discoveredAt?: Date;
}

export function MatchDetails({ matchData, discoveredAt }: MatchDetailsProps) {
  const t = useTranslations("automations");
  const formatDate = useFormatDate();
  const locale = useLocale();
  const html = useMemo(
    () => (matchData?.body ? md.render(matchData.body) : ""),
    [matchData?.body],
  );

  if (!matchData) return null;

  const recKey = matchData.recommendation
    ? recommendationKey(matchData.recommendation)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {matchData.recommendation && (
          // Title Case is English typography; Ukrainian keeps it lower case.
          <Badge
            variant="outline"
            className={cn(locale === "en" && "capitalize")}
          >
            {recKey
              ? t(`match.recommendation.${recKey}`)
              : matchData.recommendation}
          </Badge>
        )}
        {matchData.descriptionCompleteness &&
          matchData.descriptionCompleteness !== "full" && (
            <Badge
              variant="secondary"
              title={t("match.provisionalTitle")}
            >
              {t("match.provisional")}
            </Badge>
          )}
      </div>

      {html ? (
        <div className="text-sm leading-relaxed [&_p]:mt-2 [&_ul]:mt-2 [&_ol]:mt-2 [&_h2]:mt-4 [&_h2]:font-semibold">
          <TipTapContentViewer content={html} />
        </div>
      ) : matchData.summary ? (
        <div className="space-y-2">
          <p className="text-sm">{matchData.summary}</p>
          <p className="text-xs text-muted-foreground italic">
            {t("match.legacy")}
          </p>
        </div>
      ) : null}

      <div className="text-xs text-muted-foreground space-y-1">
        {matchData.resumeTitle && (
          <p>
            {t("match.resume")}{" "}
            {matchData.resumeId ? (
              <Link
                href={`/dashboard/profile/resume/${matchData.resumeId}`}
                className="font-medium underline hover:text-foreground"
              >
                {matchData.resumeTitle}
              </Link>
            ) : (
              <span className="font-medium">{matchData.resumeTitle}</span>
            )}
          </p>
        )}
        {matchData.provider && (
          <p>
            {t("match.model")}{" "}
            <span className="font-medium">
              {matchData.provider}
              {matchData.model ? ` / ${matchData.model}` : ""}
            </span>
          </p>
        )}
        <p>
          {matchData.matchedAt
            ? t("match.matchedOn", {
                date: formatDate(
                  new Date(matchData.matchedAt),
                  AUTOMATION_DATE_PATTERNS.dateAtTime,
                ),
              })
            : discoveredAt
              ? t("match.discoveredOn", {
                  date: formatDate(
                    new Date(discoveredAt),
                    AUTOMATION_DATE_PATTERNS.dateAtTime,
                  ),
                })
              : null}
        </p>
      </div>
    </div>
  );
}
