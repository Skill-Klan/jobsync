"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CircularScore } from "@/components/CircularScore";
import { StatusBadge } from "@/components/StatusBadge";
import { JobTabEmptyState } from "@/components/myjobs/job-details/JobTabEmptyState";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import type { CompanyJobRow } from "@/models/companyDetails.model";
import { useFormatDate, useLabel, useTranslations } from "@/i18n/client";
import type { DatePattern } from "@/i18n/dates";

// date-fns "PP" is the English the suite asserts on; Ukrainian puts the day first.
const APPLIED_DATE: DatePattern = { en: "PP", uk: "d MMM yyyy" };

type CompanyJobsTabProps = {
  jobs: CompanyJobRow[];
};

// Read-only on purpose: every job action already lives on the job's own page
export function CompanyJobsTab({ jobs }: CompanyJobsTabProps) {
  const t = useTranslations("library");
  const label = useLabel();
  const formatDate = useFormatDate();
  if (jobs.length === 0) {
    return (
      <JobTabEmptyState
        icon={Briefcase}
        title={t("companyDetails.jobs.emptyTitle")}
        description={t("companyDetails.jobs.emptyDescription")}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("companyDetails.jobs.title")}</TableHead>
          <TableHead>{t("companyDetails.jobs.status")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("companyDetails.jobs.location")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("companyDetails.jobs.appliedHeader")}</TableHead>
          <TableHead>{t("companyDetails.jobs.match")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("companyDetails.jobs.source")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">
              <Link
                href={`/dashboard/myjobs/${job.id}`}
                className="hover:underline underline-offset-4"
              >
                {job.JobTitle.label}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge
                label={label("jobStatus", job.Status)}
                color={getJobStatusBadgeColor(job.Status.value)}
              />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.Location?.label ?? "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.appliedDate
                ? formatDate(new Date(job.appliedDate), APPLIED_DATE)
                : job.applied
                  ? t("companyDetails.jobs.applied")
                  : t("companyDetails.jobs.notApplied")}
            </TableCell>
            <TableCell>
              {job.matchScore != null ? (
                <CircularScore score={job.matchScore} size="sm" />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {job.JobSource
                ? label("jobSource", {
                    value: job.JobSource.value ?? "",
                    label: job.JobSource.label,
                  })
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
