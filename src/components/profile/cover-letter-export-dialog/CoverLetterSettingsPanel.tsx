"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DisclosureGroup,
  ROW,
  SelectRow,
  StepperRow,
} from "@/components/pdf-export/settings-rows";
import {
  formatSettingValue,
  PDF_FONT_LABELS,
} from "@/models/pdfExport.model";
import type {
  CoverLetterExportSettings,
  CoverLetterNumericSetting,
} from "@/models/coverLetterExport.model";
import { useTranslations } from "@/i18n/client";

type CoverLetterSettingsPanelProps = {
  settings: CoverLetterExportSettings;
  onChange: (settings: CoverLetterExportSettings) => void;
  onReset?: () => void;
  isDefault?: boolean;
  /** False once the lookup has resolved and found no contact info. */
  hasLetterhead: boolean;
  headline: string;
  onHeadlineChange: (headline: string) => void;
};

const ID_PREFIX = "cover-letter-export";

export function CoverLetterSettingsPanel({
  settings,
  onChange,
  onReset,
  isDefault,
  hasLetterhead,
  headline,
  onHeadlineChange,
}: CoverLetterSettingsPanelProps) {
  const t = useTranslations("profile");
  const setNumber = (field: CoverLetterNumericSetting) => (value: number) =>
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
    t("coverLetterExport.paragraphsSummary", {
      value: settings.paragraphSpacing,
    }),
  ].join(" • ");

  return (
    <div className="flex flex-col gap-4">
      {hasLetterhead && (
        <DisclosureGroup
          title={t("coverLetterExport.letterhead")}
          summary={headline.trim() || t("coverLetterExport.noHeadline")}
        >
          <div className={ROW}>
            <Label
              htmlFor={`${ID_PREFIX}-headline`}
              className="cursor-pointer font-normal"
            >
              {t("coverLetterExport.headline")}
            </Label>
            <Input
              id={`${ID_PREFIX}-headline`}
              value={headline}
              onChange={(event) => onHeadlineChange(event.target.value)}
              placeholder={t("coverLetterExport.headlinePlaceholder")}
              className="h-8 w-full text-sm"
            />
          </div>
        </DisclosureGroup>
      )}

      {/* No Template row: a cover letter has exactly one style. */}
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
          field="paragraphSpacing"
          value={settings.paragraphSpacing}
          onCommit={setNumber("paragraphSpacing")}
        />
      </DisclosureGroup>

      {/* A page with no name on it otherwise reads as a bug, and the fix is
          not discoverable from this dialog. */}
      {!hasLetterhead && (
        <p className="text-xs text-muted-foreground">
          {t("coverLetterExport.noLetterhead")}
        </p>
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
