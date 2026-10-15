"use client";
import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { buttonVariants } from "./ui/button";

interface DeleteAlertDialogProps {
  // What is deleted, in the user's language, ready for the sentence: en "job",
  // uk the accusative with a demonstrative — «цю вакансію» (common.deleteDialog.title).
  pageTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  alertTitle?: string;
  alertDescription?: ReactNode;
  deleteAction?: boolean;
  actionLabel?: string;
  actionVariant?: "destructive" | "default";
}

export function DeleteAlertDialog({
  pageTitle,
  open,
  onOpenChange,
  onDelete,
  alertTitle,
  alertDescription,
  deleteAction = true,
  actionLabel,
  actionVariant = "destructive",
}: DeleteAlertDialogProps) {
  const t = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {alertTitle ?? t("deleteDialog.title", { item: pageTitle })}
          </AlertDialogTitle>
          {/* asChild: a description may carry a list, which cannot nest in a p. */}
          <AlertDialogDescription asChild>
            <div>{alertDescription ?? t("deleteDialog.description")}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {deleteAction && (
            <AlertDialogAction
              className={buttonVariants({ variant: actionVariant })}
              onClick={onDelete}
            >
              {actionLabel ?? t("deleteDialog.delete")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
