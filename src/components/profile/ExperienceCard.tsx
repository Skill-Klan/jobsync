"use client";
import { ResumeSection } from "@/models/profile.model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { MONTH_YEAR } from "./dates";

interface ExperienceCardProps {
  experienceSection: ResumeSection | undefined;
  openDialogForEdit: (id: string) => void;
}

function ExperienceCard({
  experienceSection,
  openDialogForEdit,
}: ExperienceCardProps) {
  const t = useTranslations("profile");
  const formatDate = useFormatDate();
  return (
    <>
      <CardTitle className="pl-6 py-3">
        {experienceSection?.sectionTitle}
      </CardTitle>
      {experienceSection?.workExperiences?.map(
        ({
          id,
          jobTitle,
          Company,
          location,
          startDate,
          endDate,
          description,
        }) => (
          <Card key={id}>
            <CardHeader className="p-2 pb-0 flex-row justify-between relative">
              <CardTitle className="text-xl pl-4">{jobTitle.label}</CardTitle>
              <Button
                title={t("buttons.edit")}
                variant="ghost"
                size="icon"
                className="h-8 w-8 absolute top-2 right-2"
                onClick={() => openDialogForEdit(id!)}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">{t("buttons.edit")}</span>
              </Button>
            </CardHeader>
            <CardContent>
              <h3>{Company.label}</h3>
              <CardDescription>
                {formatDate(startDate, MONTH_YEAR)} -{" "}
                {endDate ? formatDate(endDate, MONTH_YEAR) : t("dates.present")}
                <br />
                {location.label}
              </CardDescription>
              <div className="pt-2">
                <TipTapContentViewer content={description} />
              </div>
            </CardContent>
          </Card>
        )
      )}
    </>
  );
}

export default ExperienceCard;
