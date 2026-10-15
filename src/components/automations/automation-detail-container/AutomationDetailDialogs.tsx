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
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";

interface AutomationDetailDialogsProps {
  abortConfirmOpen: boolean;
  onAbortConfirmOpenChange: (open: boolean) => void;
  onAbortRun: () => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function AutomationDetailDialogs({
  abortConfirmOpen,
  onAbortConfirmOpenChange,
  onAbortRun,
  deleteConfirmOpen,
  onDeleteConfirmOpenChange,
  onDelete,
  isDeleting,
}: AutomationDetailDialogsProps) {
  const t = useTranslations("automations");
  return (
    <>
      <AlertDialog
        open={abortConfirmOpen}
        onOpenChange={onAbortConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.abort.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.abort.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("detail.abort.keep")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={(e) => {
                e.preventDefault();
                onAbortRun();
              }}
            >
              {t("detail.abort.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={onDeleteConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lifecycle.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("lifecycle.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("shared.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={isDeleting}
              className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
            >
              {isDeleting ? t("lifecycle.deleting") : t("shared.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
