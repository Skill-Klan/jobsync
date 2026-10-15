"use client";

import Link from "next/link";
import { AlertTriangle, Clock, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationWithResume } from "@/models/automation.model";
import { AutomationSearchConfig } from "./AutomationSearchConfig";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { AUTOMATION_DATE_PATTERNS } from "../datePatterns";

interface AutomationSummaryCardProps {
  automation: AutomationWithResume;
  retired: boolean;
  resumeMissing: boolean;
  isRunning: boolean;
  totalJobs: number;
  newJobsCount: number;
}

export function AutomationSummaryCard({
  automation,
  retired,
  resumeMissing,
  isRunning,
  totalJobs,
  newJobsCount,
}: AutomationSummaryCardProps) {
  const t = useTranslations("automations");
  const formatDate = useFormatDate();
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("detail.summary.status")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  automation.status === "active" ? "default" : "secondary"
                }
              >
                {t(`status.${automation.status}`)}
              </Badge>
              {isRunning && (
                <Badge variant="default" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("detail.summary.running")}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("shared.jobBoard")}
            </p>
            <p className="font-medium capitalize">{automation.jobBoard}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("shared.matchThreshold")}
            </p>
            <p className="font-medium">{automation.matchThreshold}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("shared.schedule")}
            </p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {t("shared.daily", {
                hour: automation.scheduleHour.toString().padStart(2, "0"),
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("shared.resume")}
            </p>
            {resumeMissing ? (
              <p className="text-amber-600 flex items-center gap-1 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {t("detail.summary.missing")}
              </p>
            ) : (
              <Link
                href={`/dashboard/profile/resume/${automation.resume.id}`}
                className="font-medium flex items-center gap-1 hover:underline"
              >
                <FileText className="h-4 w-4" />
                {automation.resume.title}
              </Link>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("detail.summary.nextRun")}
            </p>
            <p className="font-medium">
              {automation.nextRunAt && automation.status === "active"
                ? formatDate(
                    new Date(automation.nextRunAt),
                    AUTOMATION_DATE_PATTERNS.dayTime,
                  )
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("detail.summary.lastRun")}
            </p>
            <p className="font-medium">
              {automation.lastRunAt
                ? formatDate(
                    new Date(automation.lastRunAt),
                    AUTOMATION_DATE_PATTERNS.dayTime,
                  )
                : t("detail.summary.never")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("detail.summary.discoveredJobs")}
            </p>
            <p className="font-medium">
              {t("detail.summary.total", { count: totalJobs })}
              {newJobsCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {t("detail.summary.new", { count: newJobsCount })}
                </Badge>
              )}
            </p>
          </div>
        </div>

        <AutomationSearchConfig
          sourceConfig={automation.sourceConfig}
          jobBoard={automation.jobBoard}
          retired={retired}
        />
      </CardContent>
    </Card>
  );
}
