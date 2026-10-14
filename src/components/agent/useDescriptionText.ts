"use client";

import { useTranslations } from "@/i18n/client";
import type { DescriptionCompleteness } from "@/models/job.model";

const COMPLETENESS = {
  "title-only": "titleOnly",
  partial: "partial",
  full: "full",
} as const satisfies Record<DescriptionCompleteness, string>;

// The description line both add-job cards show — "Description · pasted
// verbatim · 6200 chars" — and its completeness badge.
export function useDescriptionText() {
  const t = useTranslations("agent.description");
  return {
    summary: (pasted: boolean, chars: number) =>
      t("summary", { source: t(pasted ? "pasted" : "model"), chars }),
    completeness: (value: DescriptionCompleteness) => t(COMPLETENESS[value]),
  };
}
