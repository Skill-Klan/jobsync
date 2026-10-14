"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";
import { useTranslations } from "@/i18n/client";

export function AttachPdfDialog({
  open,
  onOpenChange,
  onChoice,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoice: (choice: "replace" | "download-only") => void;
  onCancel: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resumeDialogs.replaceTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("resumeDialogs.replaceDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("buttons.cancel")}
          </AlertDialogCancel>
          <Button variant="outline" onClick={() => onChoice("download-only")}>
            {t("resumeDialogs.downloadOnly")}
          </Button>
          <AlertDialogAction onClick={() => onChoice("replace")}>
            {t("resumeDialogs.replaceAttachment")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ClearChatBeforeReviewDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resumeDialogs.clearChatTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("resumeDialogs.clearChatDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("resumeDialogs.clearAndReview")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DiscardImportDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resumeDialogs.discardImportTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("resumeDialogs.discardImportDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
            onClick={onConfirm}
          >
            {t("resumeDialogs.discardImport")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
