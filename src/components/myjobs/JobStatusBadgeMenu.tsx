"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobStatusMenuItems } from "./JobStatusMenuItems";
import { JobResponse, JobStatus } from "@/models/job.model";
import { useLabel, useTranslations } from "@/i18n/client";

type JobStatusBadgeMenuProps = {
  job: JobResponse;
  jobStatuses: JobStatus[];
  onChangeJobStatus: (id: string, status: JobStatus) => void;
  className?: string;
};

export function JobStatusBadgeMenu({
  job,
  jobStatuses,
  onChangeJobStatus,
  className,
}: JobStatusBadgeMenuProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("statusBadge.changeLabel", {
                status: job.Status ? label("jobStatus", job.Status) : "",
              })}
              className="cursor-pointer rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <JobStatusBadge job={job} className={className} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("statusBadge.clickToChange")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="p-0">
        <JobStatusMenuItems
          jobStatuses={jobStatuses}
          currentStatusId={job.Status?.id ?? ""}
          onSelectStatus={(status) => onChangeJobStatus(job.id, status)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
