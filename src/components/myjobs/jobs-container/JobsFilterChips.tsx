"use client";
import { X } from "lucide-react";
import { EMPTY_JOB_FACETS, hasJobFacets } from "@/lib/jobs/jobFacets";
import { JobFacets, JobStatus } from "@/models/job.model";
import { useLabel, useTranslations } from "@/i18n/client";
import { useJobTypeLabels } from "../useJobTypeLabels";

// "Filtered by" row for the popover facets; deep-link chips stay in the
// header (D6), so Clear all here leaves company/title/location/source alone.
export function JobsFilterChips({
  statuses,
  facets,
  onChange,
}: {
  statuses: JobStatus[];
  facets: JobFacets;
  onChange: (facets: JobFacets) => void;
}) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const types = useJobTypeLabels();
  if (!hasJobFacets(facets)) return null;

  const statusLabels = [
    ...facets.statuses.map((value) => {
      const status = statuses.find((s) => s.value === value);
      return status ? label("jobStatus", status) : value;
    }),
    ...(facets.acceptedDiscovered ? [t("filters.accepted")] : []),
  ];

  const chips = [
    {
      name: t("filters.status"),
      value: statusLabels.join(", "),
      clear: { statuses: [], acceptedDiscovered: false },
    },
    {
      name: t("filters.jobType"),
      value: facets.jobTypes.map((c) => types.jobType(c)).join(", "),
      clear: { jobTypes: [] },
    },
    {
      name: t("filters.workplace"),
      value: facets.workplaces.map((c) => types.workplaceType(c)).join(", "),
      clear: { workplaces: [] },
    },
    {
      name: t("filters.dismissed"),
      value: facets.includeDismissed ? t("filters.included") : "",
      clear: { includeDismissed: false },
    },
  ].filter((chip) => chip.value);

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="mr-0.5 text-xs text-muted-foreground">
        {t("filters.filteredBy")}
      </span>
      {chips.map((chip) => (
        <button
          key={chip.name}
          type="button"
          aria-label={t("filters.removeFilter", { name: chip.name })}
          title={chip.value}
          onClick={() => onChange({ ...facets, ...chip.clear })}
          className="inline-flex h-7 max-w-[280px] items-center gap-1.5 rounded-md bg-muted pl-2.5 pr-2 text-[13px] hover:bg-muted/70"
        >
          <span className="text-muted-foreground">{chip.name}</span>
          <span className="truncate font-medium">{chip.value}</span>
          <X className="h-3 w-3 shrink-0" />
        </button>
      ))}
      <button
        type="button"
        className="h-7 px-2 text-[13px] text-muted-foreground underline hover:text-foreground"
        onClick={() => onChange(EMPTY_JOB_FACETS)}
      >
        {t("ui.clearAll")}
      </button>
    </div>
  );
}
