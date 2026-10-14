"use client";

import Link from "next/link";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CircularScore } from "@/components/CircularScore";
import { StatusBadge } from "@/components/StatusBadge";
import { DownloadFileButton } from "@/components/profile/DownloadFileButton";
import { BADGE_COLORS, getJobStatusBadgeColor } from "@/lib/badge-colors";
import { cn, formatUrl } from "@/lib/utils";
import type { JobMatchData } from "@/models/ai.schemas";
import { JobResponse, JobStatus } from "@/models/job.model";
import { APP_CONSTANTS } from "@/lib/constants";
import { useFormatDate, useLabel, useLocale, useTranslations } from "@/i18n/client";
import { JOB_DATE, useJobTypeLabels } from "../useJobTypeLabels";

const RECOMMENDATIONS = ["strong match", "good match", "partial match", "weak match"] as const;
type Recommendation = (typeof RECOMMENDATIONS)[number];
const isRecommendation = (value: string): value is Recommendation =>
  (RECOMMENDATIONS as readonly string[]).includes(value);

type JobSummaryCardProps = {
  job: JobResponse;
  currentStatus: JobStatus;
  matchData: JobMatchData | null;
};

export function JobSummaryCard({
  job,
  currentStatus,
  matchData,
}: JobSummaryCardProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const locale = useLocale();
  const formatDate = useFormatDate();
  const types = useJobTypeLabels();
  const recommendation = matchData?.recommendation;
  const expired =
    job.dueDate &&
    new Date() > new Date(job.dueDate) &&
    currentStatus?.value === "draft";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.status")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {expired ? (
                <StatusBadge
                  label={label("jobStatus", { value: "expired" })}
                  color="amber"
                />
              ) : (
                <StatusBadge
                  label={currentStatus ? label("jobStatus", currentStatus) : ""}
                  color={getJobStatusBadgeColor(currentStatus?.value ?? "")}
                />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.jobType")}</p>
            <p className="mt-1 font-medium">
              {types.jobType(job.jobType)}
              {job.workplaceType &&
                ` · ${types.workplaceType(job.workplaceType)}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.salary")}</p>
            <p className="mt-1 font-medium">{job.salaryRange || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.source")}</p>
            <p className="mt-1 font-medium">
              {job.JobSource ? label("jobSource", job.JobSource) : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.applied")}</p>
            <p className="mt-1 font-medium">
              {job.appliedDate
                ? formatDate(new Date(job.appliedDate), JOB_DATE)
                : job.applied
                  ? t("summary.appliedNoDate")
                  : t("summary.notApplied")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.match")}</p>
            {job.matchScore != null && matchData?.analyzed !== false ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <CircularScore score={job.matchScore} size="sm" />
                {recommendation && (
                  // English shows the stored lowercase words title-cased by
                  // CSS; Ukrainian is written in sentence case.
                  <Badge
                    variant="outline"
                    className={locale === "en" ? "capitalize" : undefined}
                  >
                    {isRecommendation(recommendation)
                      ? t(`summary.recommendation.${recommendation}`)
                      : recommendation}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-1 font-medium">{t("summary.notMatched")}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.resume")}</p>
            <div className="mt-1 font-medium">
              {job.Resume?.File?.filePath ? (
                DownloadFileButton(
                  job.Resume.id!,
                  job.Resume.File.filePath,
                  job.Resume.title,
                  job.Resume.File.fileName,
                )
              ) : job.Resume?.id ? (
                <Link
                  href={`/dashboard/profile/resume/${job.Resume.id}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {job.Resume.title}
                </Link>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("summary.added")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {job.createdAt ? formatDate(new Date(job.createdAt), JOB_DATE) : "-"}
              </span>
              {job.createdVia && (
                <Badge
                  variant="outline"
                  className={cn("gap-1", BADGE_COLORS.violet)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {job.createdVia === APP_CONSTANTS.AGENT_CHAT_CREATED_VIA
                    ? t("summary.viaChat")
                    : t("summary.via", { source: job.createdVia })}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(job.jobUrl || (job.tags && job.tags.length > 0)) && (
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-4">
            {job.jobUrl && (
              <a
                href={formatUrl(job.jobUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {job.jobUrl}
              </a>
            )}
            {job.tags && job.tags.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1">
                {job.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
