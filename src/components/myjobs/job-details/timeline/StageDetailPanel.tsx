"use client";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toastActionResult } from "@/lib/toast";
import { deleteJobStage } from "@/actions/jobStage.actions";
import type { JobStage } from "@/models/jobStage.model";
import {
  askedTally,
  formatStageDateTime,
  isInterviewStage,
} from "./stageDisplay";
import { StageOverviewTab } from "./StageOverviewTab";
import { StageInterviewersTab } from "./StageInterviewersTab";
import { StagePrepList } from "./StagePrepList";
import { useLabel, useLocale, useTranslations } from "@/i18n/client";

// Underline tabs rather than the app's filled pills: this row sits inside the
// job's own pill tab bar, and two nested pill bars read as competing controls.
const TAB_TRIGGER =
  "cursor-pointer rounded-none border-b-2 border-transparent px-0 pb-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

type StageDetailPanelProps = {
  stage: JobStage;
  isCurrent: boolean;
  onEdit: () => void;
  onLinkInterviewers: () => void;
  onAddPrepQuestions: () => void;
  onChanged: () => void;
};

export function StageDetailPanel({
  stage,
  isCurrent,
  onEdit,
  onLinkInterviewers,
  onAddPrepQuestions,
  onChanged,
}: StageDetailPanelProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const locale = useLocale();
  const stageLabel = label("jobStage", stage.StageType);
  const [, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const interview = isInterviewStage(stage);
  const { asked, total } = askedTally(stage);

  // Selecting another stage re-renders this component rather than remounting
  // it, so the tab has to follow the id or an interview tab survives onto a
  // stage that has none.
  useEffect(() => {
    setTab("overview");
  }, [stage.id]);

  // Both joins cascade with the stage, so the confirmation names what goes.
  const interviewerCount = stage.interviewers?.length ?? 0;
  const prepCount = stage.prepQuestions?.length ?? 0;
  const hasLinks = interviewerCount > 0 || prepCount > 0;
  const deleteDescription =
    isCurrent || hasLinks ? (
      <>
        {isCurrent && (
          <p>{t("stageDetail.deleteCurrent")}</p>
        )}
        {hasLinks && (
          <>
            <p className={cn(isCurrent && "mt-2")}>
              {t("stageDetail.deleteAlsoRemoves")}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {interviewerCount > 0 && (
                <li>
                  {t.rich("stageDetail.deleteInterviewers", {
                    count: interviewerCount,
                    b: (chunks) => (
                      <span className="font-semibold text-foreground">{chunks}</span>
                    ),
                  })}
                </li>
              )}
              {prepCount > 0 && (
                <li>
                  {t.rich("stageDetail.deleteQuestions", {
                    count: prepCount,
                    b: (chunks) => (
                      <span className="font-semibold text-foreground">{chunks}</span>
                    ),
                  })}
                </li>
              )}
            </ul>
            <p className="mt-2">
              {interviewerCount > 0 && prepCount > 0
                ? t("stageDetail.keptBoth")
                : interviewerCount > 0
                  ? t("stageDetail.keptContacts")
                  : t("stageDetail.keptQuestions")}
            </p>
          </>
        )}
      </>
    ) : undefined;

  const onDelete = () => {
    setDeleteOpen(false);
    startTransition(async () => {
      const res = await deleteJobStage(stage.id);
      toastActionResult(res, {
        success: t("stageDetail.deleted"),
        onSuccess: onChanged,
      });
    });
  };

  return (
    <div className="flex-1 rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-lg font-bold">{stageLabel}</h3>
          {isCurrent && (
            <StatusBadge
              label={t("stageDetail.currentBadge")}
              color="emerald"
              className="text-[11px] font-bold"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            aria-label={t("stageDetail.editStage", { stage: stageLabel })}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
            aria-label={t("stageDetail.deleteStage", { stage: stageLabel })}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {formatStageDateTime(
          stage.occurredAt,
          interview ? stage.durationMins : null,
          locale,
        )}
      </p>

      {/* A one-tab bar is a control that does nothing, so a non-interview
          stage gets the overview on its own. */}
      {interview ? (
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="overview" className={TAB_TRIGGER}>
              {t("stageDetail.overview")}
            </TabsTrigger>
            <TabsTrigger value="interviewer" className={TAB_TRIGGER}>
              {t("stageDetail.interviewer")}
              {stage.interviewers.length > 0 && (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {stage.interviewers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="prep" className={TAB_TRIGGER}>
              {t("stageDetail.prepList")}
              {total > 0 && (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {t("stageDetail.askedOf", { asked, total })}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <StageOverviewTab stage={stage} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="interviewer" className="mt-4">
            <StageInterviewersTab
              stage={stage}
              onLinkInterviewers={onLinkInterviewers}
              onChanged={onChanged}
            />
          </TabsContent>
          <TabsContent value="prep" className="mt-4">
            <StagePrepList
              stage={stage}
              onAddPrepQuestions={onAddPrepQuestions}
              onChanged={onChanged}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <hr className="my-4" />
          <StageOverviewTab stage={stage} onChanged={onChanged} />
        </>
      )}

      <DeleteAlertDialog
        pageTitle={t("deleteItem.stage")}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDelete={onDelete}
        alertTitle={t("stageDetail.deleteTitle", { stage: stageLabel })}
        alertDescription={deleteDescription}
      />
    </div>
  );
}
