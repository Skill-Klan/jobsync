"use client";
import {
  Calendar,
  DollarSign,
  MapPin,
  Pencil,
  PlusCircle,
  StickyNote,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CircularScore } from "@/components/CircularScore";
import { JobResponse, JobStatus } from "@/models/job.model";
import { useFormatDate, useLabel, useTranslations } from "@/i18n/client";
import { JOB_DATE, useJobTypeLabels } from "./useJobTypeLabels";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobActionsMenu } from "./JobActionsMenu";
import { MatchJobButton } from "./MatchJobButton";
import { CompanyLogo } from "./CompanyLogo";

type JobCardProps = {
  job: JobResponse;
  jobStatuses: JobStatus[];
  editJob: (id: string) => void;
  onChangeJobStatus: (id: string, status: JobStatus) => void;
  onAddNote: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
};

export function JobCard({
  job,
  jobStatuses,
  editJob,
  onChangeJobStatus,
  onAddNote,
  onDeleteJob,
}: JobCardProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const formatDate = useFormatDate();
  const types = useJobTypeLabels();
  const notesCount = job._count?.Notes ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo
          logoUrl={job.Company?.logoUrl}
          className="h-10 w-10 min-w-10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/dashboard/myjobs/${job?.id}`}
              className="truncate font-semibold text-primary underline-offset-4 hover:underline"
            >
              {job.JobTitle?.label}
            </Link>
            {notesCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 shrink-0 px-1.5 py-0 text-xs"
              >
                <StickyNote className="mr-0.5 h-3 w-3" />
                {notesCount}
              </Badge>
            )}
          </div>
          {job.Company?.id ? (
            <Link
              href={`/dashboard/admin/companies/${job.Company.id}`}
              className="block truncate text-sm text-teal-600 underline-offset-4 hover:underline"
            >
              {job.Company.label}
            </Link>
          ) : (
            <p className="truncate text-sm text-muted-foreground">
              {job.Company?.label}
            </p>
          )}
        </div>
        {job.matchScore != null ? (
          <CircularScore score={job.matchScore} size="sm" animate={false} />
        ) : (
          <MatchJobButton jobId={job.id} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {job.Location?.label && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.Location.label}</span>
          </span>
        )}
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {job.appliedDate
            ? formatDate(job.appliedDate, JOB_DATE)
            : job.applied
              ? t("card.applied")
              : t("card.notApplied")}
        </span>
        {job.JobSource?.label && (
          <span className="flex min-w-0 items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label("jobSource", job.JobSource)}</span>
          </span>
        )}
        {job.salaryRange && (
          <span className="flex min-w-0 items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.salaryRange}</span>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <JobStatusBadge job={job} />
          <span className="truncate text-xs text-muted-foreground">
            {[
              types.jobType(job.jobType),
              job.workplaceType ? types.workplaceType(job.workplaceType) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={t("ui.editJob")}
            aria-label={t("ui.editJob")}
            onClick={() => editJob(job.id)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t("ui.deleteJob")}
            aria-label={t("ui.deleteJob")}
            className="text-destructive hover:text-destructive"
            onClick={() => onDeleteJob(job.id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
          <JobActionsMenu
            job={job}
            jobStatuses={jobStatuses}
            onChangeJobStatus={onChangeJobStatus}
            onAddNote={onAddNote}
          />
        </div>
      </div>
    </div>
  );
}
