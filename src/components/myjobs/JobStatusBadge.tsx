"use client";
import { Badge } from "../ui/badge";
import { StatusBadge } from "../StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import { cn } from "@/lib/utils";
import { JobResponse } from "@/models/job.model";
import { useLabel } from "@/i18n/client";

type JobStatusBadgeProps = {
  job: JobResponse;
  className?: string;
};

// Dismissed and past-due drafts override the stored status. Shared by the
// table and card views so the two can't disagree about the same job.
export function JobStatusBadge({ job, className }: JobStatusBadgeProps) {
  const label = useLabel();
  if (job.discoveryStatus === "dismissed") {
    return (
      <Badge
        variant="outline"
        className={cn("text-muted-foreground", className)}
      >
        {label("discoveryStatus", { value: "dismissed" })}
      </Badge>
    );
  }

  if (job.dueDate && new Date() > job.dueDate && job.Status?.value === "draft") {
    return (
      <StatusBadge
        label={label("jobStatus", { value: "expired" })}
        color="amber"
        className={className}
      />
    );
  }

  return (
    <StatusBadge
      label={job.Status ? label("jobStatus", job.Status) : ""}
      color={getJobStatusBadgeColor(job.Status?.value ?? "")}
      className={className}
    />
  );
}
