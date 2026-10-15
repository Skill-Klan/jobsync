"use client";
import { Clock, MapPin, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STAGE_OUTCOMES } from "@/lib/constants";
import type { JobStage } from "@/models/jobStage.model";
import { isInterviewStage } from "./stageDisplay";
import { StageNotes } from "./StageNotes";
import { useLabel, useTranslations } from "@/i18n/client";

type StageOverviewTabProps = {
  stage: JobStage;
  onChanged: () => void;
};

function StageFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon: LucideIcon;
}) {
  const t = useTranslations("jobs");
  return (
    <div>
      <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="mt-1.5 flex items-center gap-2 text-sm">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {value ?? (
          <span className="text-muted-foreground">{t("stageOverview.notSet")}</span>
        )}
      </p>
    </div>
  );
}

export function StageOverviewTab({ stage, onChanged }: StageOverviewTabProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const outcome = STAGE_OUTCOMES.find((o) => o.value === stage.outcome);
  const outcomeLabel = outcome ? label("stageOutcome", outcome) : undefined;

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
          {t("stageOverview.outcome")}
        </span>
        <p className="mt-1.5 text-sm">
          {outcomeLabel ? (
            <Badge variant="secondary">{outcomeLabel}</Badge>
          ) : (
            <span className="text-muted-foreground">
              {t("stageOverview.notRecorded")}
            </span>
          )}
        </p>
      </div>

      {isInterviewStage(stage) && (
        <div className="grid gap-4 @lg/timeline:grid-cols-3">
          <StageFact
            label={t("stageOverview.location")}
            value={stage.location}
            icon={MapPin}
          />
          <StageFact
            label={t("stageOverview.format")}
            value={stage.format}
            icon={Monitor}
          />
          <StageFact
            label={t("stageOverview.duration")}
            value={
              stage.durationMins
                ? t("timeline.minutes", { count: stage.durationMins })
                : null
            }
            icon={Clock}
          />
        </div>
      )}

      <StageNotes stage={stage} onChanged={onChanged} />
    </div>
  );
}
