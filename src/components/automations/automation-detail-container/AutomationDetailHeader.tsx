"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Pause,
  Play,
  RefreshCw,
  Loader2,
  AlertTriangle,
  PlayCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationWithResume } from "@/models/automation.model";
import { useTranslations } from "@/i18n/client";

interface AutomationDetailHeaderProps {
  automation: AutomationWithResume;
  retired: boolean;
  resumeMissing: boolean;
  runActive: boolean;
  aborting: boolean;
  actionLoading: boolean;
  jobsBusy: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPauseResume: () => void;
  onAbort: () => void;
  onRunNow: () => void;
}

export function AutomationDetailHeader({
  automation,
  retired,
  resumeMissing,
  runActive,
  aborting,
  actionLoading,
  jobsBusy,
  onRefresh,
  onEdit,
  onDelete,
  onPauseResume,
  onAbort,
  onRunNow,
}: AutomationDetailHeaderProps) {
  const t = useTranslations("automations");
  const { keywords, location } = automation;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 min-w-0 items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/automations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{automation.name}</h1>
          {retired && (
            <p className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("detail.header.retired", { board: automation.jobBoard })}
            </p>
          )}
          {(keywords || location) && (
            <p className="text-muted-foreground">
              {keywords && location
                ? t("detail.header.keywordsIn", { keywords, location })
                : keywords || location}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {!retired && (
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {t("lifecycle.edit")}
          </Button>
        )}
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t("shared.delete")}
        </Button>
        {!retired && (
          <Button
            variant="outline"
            onClick={onPauseResume}
            disabled={actionLoading || resumeMissing}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : automation.status === "active" ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {automation.status === "active"
              ? t("lifecycle.pause")
              : t("lifecycle.resume")}
          </Button>
        )}
        {retired ? null : runActive ? (
          <Button
            variant="destructive"
            onClick={onAbort}
            disabled={aborting}
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {aborting ? t("detail.header.aborting") : t("detail.header.abortRun")}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onRunNow}
            disabled={
              resumeMissing || automation.status === "paused" || jobsBusy
            }
            title={
              jobsBusy ? t("detail.header.waitAnalysis") : undefined
            }
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {t("detail.header.runNow")}
          </Button>
        )}
      </div>
    </div>
  );
}
