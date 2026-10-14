"use client";
import { CalendarClock } from "lucide-react";
import type { JobStage, JobStageTypeRef } from "@/models/jobStage.model";
import { JobTabEmptyState } from "../JobTabEmptyState";
import { StageHistoryList } from "./StageHistoryList";
import { StageDetailPanel } from "./StageDetailPanel";
import { terminalStagesFor } from "./stageDisplay";
import { useTranslations } from "@/i18n/client";

type JobTimelineTabProps = {
  stages: JobStage[];
  stageTypes: JobStageTypeRef[];
  selectedStageId: string | null;
  currentStageId: string | null;
  onSelect: (stageId: string) => void;
  onAddStage: () => void;
  onEditStage: (stage: JobStage) => void;
  onLinkInterviewers: () => void;
  onAddPrepQuestions: () => void;
  onChanged: () => void;
};

export function JobTimelineTab({
  stages,
  stageTypes,
  selectedStageId,
  currentStageId,
  onSelect,
  onAddStage,
  onEditStage,
  onLinkInterviewers,
  onAddPrepQuestions,
  onChanged,
}: JobTimelineTabProps) {
  const t = useTranslations("jobs");
  // A job restored from a pre-feature backup is permanently stageless, so
  // this is a supported state, not a transient one.
  if (stages.length === 0) {
    return (
      <JobTabEmptyState
        icon={CalendarClock}
        title={t("timeline.emptyTitle")}
        description={t("timeline.emptyDescription")}
        actionLabel={t("timeline.addStage")}
        onAction={onAddStage}
        actionTestId="timeline-add-stage-btn"
      />
    );
  }

  const selected = stages.find((s) => s.id === selectedStageId) ?? null;
  const terminalTypes = terminalStagesFor(stages, stageTypes);

  return (
    <div className="@container/timeline">
      <div className="flex flex-col gap-6 @3xl/timeline:flex-row @3xl/timeline:items-start">
        <div className="w-full shrink-0 @3xl/timeline:w-[340px]">
          <StageHistoryList
            stages={stages}
            selectedStageId={selectedStageId}
            currentStageId={currentStageId}
            terminalTypes={terminalTypes}
            onSelect={onSelect}
            onAddStage={onAddStage}
          />
        </div>
        {selected && (
          <StageDetailPanel
            stage={selected}
            isCurrent={selected.id === currentStageId}
            onEdit={() => onEditStage(selected)}
            onLinkInterviewers={onLinkInterviewers}
            onAddPrepQuestions={onAddPrepQuestions}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
}
