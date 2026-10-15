"use client";

import { Button } from "@/components/ui/button";
import {
  DisclosureGroup,
  ROW,
  SelectRow,
  StepperRow,
} from "@/components/pdf-export/settings-rows";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  formatSettingValue,
  PDF_FONT_LABELS,
} from "@/models/pdfExport.model";
import {
  type ResumeExportSettings,
  type ResumeNumericSetting,
} from "@/models/resumeExport.model";
import { useTranslations } from "@/i18n/client";

type ExportSettingsPanelProps = {
  settings: ResumeExportSettings;
  onChange: (settings: ResumeExportSettings) => void;
  onReset?: () => void;
  isDefault?: boolean;
  // Hides the Footer group: a one-page resume prints no page number.
  singlePage?: boolean;
};

const ID_PREFIX = "resume-export";

export function ExportSettingsPanel({
  settings,
  onChange,
  onReset,
  isDefault,
  singlePage,
}: ExportSettingsPanelProps) {
  const t = useTranslations("profile");
  // Same keys and order as RESUME_LAYOUT_LABELS; the names follow the language.
  const templateLabels = {
    simple: t("resumeExport.templates.simple"),
    professional: t("resumeExport.templates.professional"),
  } satisfies Record<ResumeExportSettings["template"], string>;
  const setNumber = (field: ResumeNumericSetting) => (value: number) =>
    onChange({ ...settings, [field]: value });

  const typographySummary = [
    PDF_FONT_LABELS[settings.font],
    formatSettingValue("fontSize", settings.fontSize),
    t("pdfExport.lineSummary", {
      value: formatSettingValue("lineHeight", settings.lineHeight),
    }),
  ].join(" • ");

  const layoutSummary = [
    t("pdfExport.marginsSummary", {
      vertical: settings.marginVertical,
      horizontal: settings.marginHorizontal,
    }),
    t("resumeExport.spacingSummary", {
      section: settings.sectionSpacing,
      entry: settings.entrySpacing,
    }),
  ].join(" • ");

  return (
    <div className="flex flex-col gap-4">
      {/* Template reshapes everything below it, so it never folds away. */}
      <div className="rounded-lg border bg-muted/40">
        <SelectRow
          id={`${ID_PREFIX}-template`}
          label={t("resumeExport.template")}
          value={settings.template}
          labels={templateLabels}
          onSelect={(template) => onChange({ ...settings, template })}
        />
      </div>

      <DisclosureGroup
        title={t("pdfExport.typography")}
        summary={typographySummary}
      >
        <SelectRow
          id={`${ID_PREFIX}-font`}
          label={t("pdfExport.font")}
          value={settings.font}
          labels={PDF_FONT_LABELS}
          onSelect={(font) => onChange({ ...settings, font })}
        />
        <StepperRow
          idPrefix={ID_PREFIX}
          field="fontSize"
          value={settings.fontSize}
          onCommit={setNumber("fontSize")}
        />
        <StepperRow
          idPrefix={ID_PREFIX}
          field="lineHeight"
          value={settings.lineHeight}
          onCommit={setNumber("lineHeight")}
        />
      </DisclosureGroup>

      <DisclosureGroup title={t("pdfExport.layout")} summary={layoutSummary}>
        <StepperRow
          idPrefix={ID_PREFIX}
          field="marginVertical"
          value={settings.marginVertical}
          onCommit={setNumber("marginVertical")}
        />
        <StepperRow
          idPrefix={ID_PREFIX}
          field="marginHorizontal"
          value={settings.marginHorizontal}
          onCommit={setNumber("marginHorizontal")}
        />
        <StepperRow
          idPrefix={ID_PREFIX}
          field="sectionSpacing"
          value={settings.sectionSpacing}
          onCommit={setNumber("sectionSpacing")}
        />
        <StepperRow
          idPrefix={ID_PREFIX}
          field="entrySpacing"
          value={settings.entrySpacing}
          onCommit={setNumber("entrySpacing")}
        />
      </DisclosureGroup>

      {/* Its only option does nothing on a one-page resume. */}
      {!singlePage && (
        <DisclosureGroup
          title={t("resumeExport.footer")}
          summary={
            settings.showPageNumbers
              ? t("resumeExport.pageNumbersOn")
              : t("resumeExport.pageNumbersOff")
          }
        >
          <div className={ROW}>
            <Label
              htmlFor={`${ID_PREFIX}-showPageNumbers`}
              className="cursor-pointer font-normal"
            >
              {t("resumeExport.showPageNumbers")}
            </Label>
            <Switch
              id={`${ID_PREFIX}-showPageNumbers`}
              className="ml-auto"
              checked={settings.showPageNumbers}
              onCheckedChange={(showPageNumbers) =>
                onChange({ ...settings, showPageNumbers })
              }
            />
          </div>
        </DisclosureGroup>
      )}

      {onReset && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isDefault}
          >
            {t("pdfExport.resetToDefaults")}
          </Button>
        </div>
      )}
    </div>
  );
}
