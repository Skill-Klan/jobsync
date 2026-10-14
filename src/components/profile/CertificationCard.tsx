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
import { Pencil, ExternalLink, Trash2 } from "lucide-react";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { MONTH_YEAR } from "./dates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

interface CertificationCardProps {
  certificationSection: ResumeSection | undefined;
  openDialogForEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function CertificationCard({
  certificationSection,
  openDialogForEdit,
  onDelete,
}: CertificationCardProps) {
  const t = useTranslations("profile");
  const formatDate = useFormatDate();
  const { sectionTitle, licenseOrCertifications } = certificationSection!;
  return (
    <>
      <CardTitle className="pl-6 py-3">{sectionTitle}</CardTitle>
      {licenseOrCertifications?.map(
        ({
          id,
          title,
          organization,
          issueDate,
          expirationDate,
          credentialUrl,
        }) => (
          <Card key={id}>
            <CardHeader className="p-2 pb-0 flex-row justify-between relative">
              <CardTitle className="text-xl pl-4">{title}</CardTitle>
              <div className="flex gap-1 absolute top-2 right-2">
                <Button
                  title={t("buttons.edit")}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openDialogForEdit(id!)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("buttons.edit")}</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      title={t("buttons.delete")}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">{t("buttons.delete")}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("certification.deleteTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("certification.deleteDescription", { title })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("buttons.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
                        onClick={() => onDelete(id!)}
                      >
                        {t("buttons.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <h3>{organization}</h3>
              <CardDescription>
                {issueDate && (
                  <>
                    {t("certification.issued", {
                      date: formatDate(new Date(issueDate), MONTH_YEAR),
                    })}
                  </>
                )}
                {issueDate && expirationDate && " · "}
                {expirationDate ? (
                  <>
                    {t("certification.expires", {
                      date: formatDate(new Date(expirationDate), MONTH_YEAR),
                    })}
                  </>
                ) : (
                  issueDate && ` · ${t("certification.noExpirationShort")}`
                )}
              </CardDescription>
              {credentialUrl && (
                <a
                  href={credentialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline mt-1"
                >
                  {t("certification.viewCredential")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </CardContent>
          </Card>
        ),
      )}
    </>
  );
}

export default CertificationCard;
