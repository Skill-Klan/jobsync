"use client";

import { useTranslations } from "@/i18n/client";

export function NoResumesNotice() {
  const t = useTranslations("agent.results");
  return <p className="text-sm">{t("noResumes")}</p>;
}
