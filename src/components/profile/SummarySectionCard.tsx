"use client";
import { Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ResumeSection } from "@/models/profile.model";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { useTranslations } from "@/i18n/client";

interface SummarySectionCardProps {
  summarySection: ResumeSection | undefined;
  openDialogForEdit: () => void;
}

function SummarySectionCard({
  summarySection,
  openDialogForEdit,
}: SummarySectionCardProps) {
  const t = useTranslations("profile");
  const { sectionTitle, summary } = summarySection!;
  return (
    <>
      <CardTitle className="pl-6 py-3">{sectionTitle}</CardTitle>
      <Card>
        <CardHeader className="p-2 pb-0 flex-row justify-end items-center">
          <Button
            title={t("buttons.edit")}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={openDialogForEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">{t("buttons.edit")}</span>
          </Button>
        </CardHeader>
        <CardContent>
          <TipTapContentViewer content={summary?.content!} />
        </CardContent>
      </Card>
    </>
  );
}

export default SummarySectionCard;
