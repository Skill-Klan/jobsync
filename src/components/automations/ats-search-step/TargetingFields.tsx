"use client";

import { TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAllJobTitles, createJobTitle } from "@/actions/jobtitle.actions";
import { getAllTags, createTag } from "@/actions/tag.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { createLocation } from "@/actions/job.actions";
import { EntityStringChipInput } from "./EntityStringChipInput";
import type { AtsConfigValue } from "./types";
import { useTranslations } from "@/i18n/client";

interface TargetingFieldsProps {
  value: AtsConfigValue;
  onChange: (next: AtsConfigValue) => void;
}

export function TargetingFields({ value, onChange }: TargetingFieldsProps) {
  const t = useTranslations("automations");
  // Without target titles or keywords there is no signal to rank jobs against,
  // so the relevance floor drops everything and nothing is saved.
  const noSignal =
    (value.targetTitles?.length ?? 0) === 0 &&
    (value.keywords?.length ?? 0) === 0;

  return (
    <>
      <EntityStringChipInput
        label={t("search.targeting.titles.label")}
        placeholder={t("search.targeting.titles.placeholder")}
        texts={{
          search: t("search.targeting.titles.search"),
          empty: t("search.targeting.titles.empty"),
          createFailed: t("search.targeting.titles.createFailed"),
        }}
        description={t("search.targeting.titles.hint")}
        values={value.targetTitles ?? []}
        onChange={(next) => onChange({ ...value, targetTitles: next })}
        loadOptions={async () => {
          const res = await getAllJobTitles();
          return Array.isArray(res) ? res : [];
        }}
        createOption={async (lbl) => {
          const res = await createJobTitle(lbl);
          return res?.id ? res : null;
        }}
      />

      <EntityStringChipInput
        label={t("search.targeting.keywords.label")}
        placeholder={t("search.targeting.keywords.placeholder")}
        texts={{
          search: t("search.targeting.keywords.search"),
          empty: t("search.targeting.keywords.empty"),
          createFailed: t("search.targeting.keywords.createFailed"),
        }}
        description={t("search.targeting.keywords.hint")}
        values={value.keywords ?? []}
        onChange={(next) => onChange({ ...value, keywords: next })}
        loadOptions={async () => {
          const res = await getAllTags();
          return Array.isArray(res) ? res : [];
        }}
        createOption={async (lbl) => {
          const res = await createTag(lbl);
          return res?.success ? res.data : null;
        }}
      />

      {noSignal && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t("search.targeting.noSignal")}</span>
        </div>
      )}

      <EntityStringChipInput
        label={t("shared.locations")}
        placeholder={t("search.targeting.locations.placeholder")}
        texts={{
          search: t("search.targeting.locations.search"),
          empty: t("search.targeting.locations.empty"),
          createFailed: t("search.targeting.locations.createFailed"),
        }}
        description={t("search.targeting.locations.hint")}
        values={value.locations ?? []}
        onChange={(next) => onChange({ ...value, locations: next })}
        loadOptions={async () => {
          const res = await getAllJobLocations();
          return Array.isArray(res) ? res : [];
        }}
        createOption={async (lbl) => {
          const res = await createLocation(lbl);
          return res?.success ? res.data : null;
        }}
      />

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <Label>{t("search.targeting.strictLabel")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("search.targeting.strictHint")}
          </p>
        </div>
        <Switch
          checked={!!value.strictLocation}
          disabled={(value.locations ?? []).length === 0}
          onCheckedChange={(checked) =>
            onChange({ ...value, strictLocation: checked })
          }
        />
      </div>
    </>
  );
}
