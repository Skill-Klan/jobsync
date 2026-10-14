"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  MoreVertical,
  Pause,
  Play,
  Pencil,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { AutomationWithResume } from "@/models/automation.model";
import { isRetiredBoard } from "@/models/automation.model";
import {
  deleteAutomation,
  pauseAutomation,
  resumeAutomation,
} from "@/actions/automation.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import Link from "next/link";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { AUTOMATION_DATE_PATTERNS } from "./datePatterns";

interface AutomationListProps {
  automations: AutomationWithResume[];
  onEdit: (automation: AutomationWithResume) => void;
  onRefresh: () => void;
}

export function AutomationList({
  automations,
  onEdit,
  onRefresh,
}: AutomationListProps) {
  const t = useTranslations("automations");
  const formatDate = useFormatDate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handlePause = async (id: string) => {
    setLoadingAction(id);
    const result = await pauseAutomation(id);
    setLoadingAction(null);

    if (result.success) {
      toastSuccess(t("lifecycle.paused"));
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  const handleResume = async (id: string) => {
    setLoadingAction(id);
    const result = await resumeAutomation(id);
    setLoadingAction(null);

    if (result.success) {
      toastSuccess(t("lifecycle.resumed"));
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    const result = await deleteAutomation(deleteId);
    setIsDeleting(false);
    setDeleteId(null);

    if (result.success) {
      toastSuccess(t("lifecycle.deleted"));
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  if (automations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("list.emptyTitle")}</h3>
          <p className="text-muted-foreground text-center mt-2">
            {t("list.emptyBody")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {automations.map((automation) => {
          const isLoading = loadingAction === automation.id;
          const resumeMissing = !automation.resume;

          const retired = isRetiredBoard(automation.jobBoard);
          const ats = (() => {
            try {
              return JSON.parse(automation.sourceConfig ?? "{}")[
                automation.jobBoard
              ];
            } catch {
              return null;
            }
          })();
          const atsCompanies: { name: string; token: string }[] =
            ats?.companies ?? [];
          const atsTitles: string[] = ats?.targetTitles ?? [];
          const atsLocations: string[] = ats?.locations ?? [];
          const atsKeywords: string[] = ats?.keywords ?? [];
          const atsTopK: number = ats?.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN;
          const atsSaveUnanalyzed: boolean = ats?.saveUnanalyzed !== false;

          return (
            <div
              key={automation.id}
              className="flex items-start justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/dashboard/automations/${automation.id}`}
                    className="font-semibold hover:underline"
                  >
                    {automation.name}
                  </Link>
                  <Badge variant="outline" className="capitalize">
                    {automation.jobBoard}
                  </Badge>
                  {retired ? (
                    <Badge variant="destructive">{t("list.retired")}</Badge>
                  ) : (
                    <Badge
                      variant={
                        automation.status === "active" ? "default" : "secondary"
                      }
                    >
                      {t(`status.${automation.status}`)}
                    </Badge>
                  )}
                </div>

                {retired && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{t("list.retiredWarning")}</span>
                  </div>
                )}

                {!retired && resumeMissing && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{t("list.resumeMissing")}</span>
                  </div>
                )}

                {!retired && (
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1">
                      {atsCompanies.slice(0, 3).map((c) => (
                        <Badge key={c.token} variant="secondary">
                          {c.name}
                        </Badge>
                      ))}
                      {atsCompanies.length > 3 && (
                        <Badge variant="secondary">
                          {t("list.moreCompanies", {
                            count: atsCompanies.length - 3,
                          })}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        <span className="font-medium text-foreground">
                          {t("list.titles")}
                        </span>{" "}
                        {atsTitles.length
                          ? atsTitles.join(", ")
                          : t("list.notSet")}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          {t("list.keywords")}
                        </span>{" "}
                        {atsKeywords.length
                          ? atsKeywords.join(", ")
                          : t("shared.any")}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          {t("list.location")}
                        </span>{" "}
                        {atsLocations.length
                          ? atsLocations.join(", ")
                          : t("shared.anyLocation")}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          {t("list.analyzedPerRun")}
                        </span>{" "}
                        {atsTopK}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          {t("list.extraListings")}
                        </span>{" "}
                        {atsSaveUnanalyzed ? t("list.on") : t("list.off")}
                      </span>
                      {automation.resume && (
                        <span>
                          <span className="font-medium text-foreground">
                            {t("list.resume")}
                          </span>{" "}
                          {automation.resume.title}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {t("shared.daily", {
                        hour: automation.scheduleHour
                          .toString()
                          .padStart(2, "0"),
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>
                      {t("list.threshold", { value: automation.matchThreshold })}
                    </span>
                  </div>
                  {!retired &&
                    automation.nextRunAt &&
                    automation.status === "active" && (
                      <span className="text-xs">
                        {t("list.next", {
                          date: formatDate(
                            new Date(automation.nextRunAt),
                            AUTOMATION_DATE_PATTERNS.dayTime,
                          ),
                        })}
                      </span>
                    )}
                  {automation.lastRunAt && (
                    <span className="text-xs">
                      {t("list.last", {
                        date: formatDate(
                          new Date(automation.lastRunAt),
                          AUTOMATION_DATE_PATTERNS.dayTime,
                        ),
                      })}
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isLoading}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!retired &&
                    (automation.status === "active" ? (
                      <DropdownMenuItem
                        onClick={() => handlePause(automation.id)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        {t("lifecycle.pause")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleResume(automation.id)}
                        disabled={resumeMissing}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {t("lifecycle.resume")}
                      </DropdownMenuItem>
                    ))}
                  {!retired && (
                    <>
                      <DropdownMenuItem onClick={() => onEdit(automation)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("lifecycle.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(automation.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("shared.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lifecycle.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("lifecycle.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("shared.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
            >
              {isDeleting ? t("lifecycle.deleting") : t("shared.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
