"use client";
import { useTranslations } from "@/i18n/client";
import type { DatePattern } from "@/i18n/dates";
import { JOB_TYPES, WORKPLACE_TYPES } from "@/models/job.model";

// Job type and workplace are stored as codes (FT, REMOTE); the words shown for
// them live in the `jobs` dictionary. An unknown or missing code reads as
// "Not specified", as getJobTypeLabel/getWorkplaceTypeLabel do.
type JobTypeCode = keyof typeof JOB_TYPES;
type WorkplaceCode = keyof typeof WORKPLACE_TYPES;

const isJobType = (code: string): code is JobTypeCode =>
  Object.prototype.hasOwnProperty.call(JOB_TYPES, code);
const isWorkplace = (code: string): code is WorkplaceCode =>
  Object.prototype.hasOwnProperty.call(WORKPLACE_TYPES, code);

export const JOB_TYPE_CODES = Object.keys(JOB_TYPES) as JobTypeCode[];
export const WORKPLACE_CODES = Object.keys(WORKPLACE_TYPES) as WorkplaceCode[];

export function useJobTypeLabels() {
  const t = useTranslations("jobs");
  return {
    jobType: (code?: string | null) =>
      code && isJobType(code) ? t(`jobType.${code}`) : t("notSpecified"),
    workplaceType: (code?: string | null) =>
      code && isWorkplace(code) ? t(`workplaceType.${code}`) : t("notSpecified"),
  };
}

// date-fns "PP"/"PPp" are English-shaped ("Jan 15, 2025"); Ukrainian puts the
// day first and uses 24-hour time.
export const JOB_DATE: DatePattern = { en: "PP", uk: "d MMM yyyy" };
export const JOB_DATE_TIME: DatePattern = { en: "PPp", uk: "d MMM yyyy, HH:mm" };
