"use client";

import { useState } from "react";
import { PdfExportDialog } from "@/components/pdf-export/PdfExportDialog";
import type { Resume } from "@/models/profile.model";
import { settingsKey } from "@/models/pdfExport.model";
import {
  RESUME_TEMPLATE_DEFAULTS,
  type ResumeExportSettings,
} from "@/models/resumeExport.model";
import { ExportSettingsPanel } from "./export-pdf-dialog/ExportSettingsPanel";
import { canExportResume } from "./resume-container/useResumePdfExport";
import { useResumeExportSettings } from "./resume-container/useResumeExportSettings";
import { useResumePdfPreview } from "./resume-container/useResumePdfPreview";
import { useTranslations } from "@/i18n/client";

type ExportPdfDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: Resume;
  onExport: (
    settings: ResumeExportSettings,
    prepared?: { blob: Blob; filename: string } | null,
  ) => void;
};

export function ExportPdfDialog({
  open,
  onOpenChange,
  resume,
  onExport,
}: ExportPdfDialogProps) {
  const t = useTranslations("profile");
  const { settings, setSettings, ready, reset } = useResumeExportSettings(open);
  const isDefault =
    settingsKey(settings) ===
    settingsKey(RESUME_TEMPLATE_DEFAULTS[settings.template]);

  // 0 until the preview has drawn, so the toggle is never locked on a guess.
  const [pageCount, setPageCount] = useState(0);

  const canExport = canExportResume(resume);
  const { blob, filename, isGenerating, error } = useResumePdfPreview(
    resume,
    settings,
    open && ready,
  );

  return (
    <PdfExportDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pdfExport.title")}
      description={t("pdfExport.description")}
      previewLabel={t("resumeExport.previewLabel")}
      emptyMessage={t("resumeExport.emptyMessage")}
      blob={blob}
      filename={filename}
      isGenerating={isGenerating}
      hasError={!!error}
      canExport={canExport}
      onPageCountChange={setPageCount}
      onExport={(prepared) => onExport(settings, prepared)}
      settingsPanel={
        <ExportSettingsPanel
          settings={settings}
          onChange={setSettings}
          onReset={reset}
          isDefault={isDefault}
          singlePage={pageCount === 1}
        />
      }
    />
  );
}
