"use client";

import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { AtsConfigValue } from "../AtsSearchStep";
import type { WizardResume } from "./wizardConfig";
import { useTranslations } from "@/i18n/client";

export function StepReview({
  formValues,
  atsConfig,
  selectedResume,
}: {
  formValues: CreateAutomationInput;
  atsConfig: AtsConfigValue;
  selectedResume?: WizardResume;
}) {
  const t = useTranslations("automations");
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t("wizard.review.name")}</span>
        <span className="font-medium">{formValues.name || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t("shared.jobBoard")}</span>
        <span className="font-medium capitalize">
          {formValues.jobBoard || "-"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("shared.companies")}</span>
        <span className="font-medium text-right">
          {atsConfig.companies?.length
            ? atsConfig.companies.map((c) => c.name).join(", ")
            : "-"}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">
          {t("shared.targetTitles")}
        </span>
        <span className="font-medium text-right">
          {atsConfig.targetTitles?.length
            ? atsConfig.targetTitles.join(", ")
            : t("shared.any")}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{t("shared.locations")}</span>
        <span className="font-medium text-right">
          {atsConfig.locations?.length
            ? `${atsConfig.locations.join(", ")}${
                atsConfig.strictLocation ? ` ${t("shared.strict")}` : ""
              }`
            : t("shared.anyLocation")}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">
          {t("shared.analyzedPerRun")}
        </span>
        <span className="font-medium text-right">
          {atsConfig.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">
          {t("wizard.review.saveAdditional")}
        </span>
        <span className="font-medium text-right">
          {atsConfig.saveUnanalyzed !== false
            ? t("wizard.review.yes")
            : t("wizard.review.no")}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t("shared.resume")}</span>
        <span className="font-medium">
          {selectedResume?.title || t("wizard.review.notSelected")}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          {t("shared.matchThreshold")}
        </span>
        <span className="font-medium">{formValues.matchThreshold ?? 80}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t("shared.schedule")}</span>
        <span className="font-medium">
          {t("wizard.review.dailyAt", {
            hour: (formValues.scheduleHour ?? 8).toString().padStart(2, "0"),
          })}
        </span>
      </div>
    </div>
  );
}
