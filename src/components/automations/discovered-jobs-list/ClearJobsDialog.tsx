"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { toastSuccess, toastError } from "@/lib/toast";
import { clearDiscoveredJobs } from "@/actions/automation.actions";
import { useTranslations } from "@/i18n/client";

interface ClearJobsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  includeNew: boolean;
  onIncludeNewChange: (includeNew: boolean) => void;
  newCount: number;
  automationId: string;
  onRefresh: () => void;
}

export function ClearJobsDialog({
  open,
  onOpenChange,
  includeNew,
  onIncludeNewChange,
  newCount,
  automationId,
  onRefresh,
}: ClearJobsDialogProps) {
  const t = useTranslations("automations");
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    const result = await clearDiscoveredJobs({
      automationId,
      includeNew,
    });
    setClearing(false);
    onOpenChange(false);

    if (result.success) {
      toastSuccess(
        t("discovered.clear.removed", { count: result.deleted ?? 0 }),
        t("discovered.clear.clearedTitle"),
      );
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("discovered.clear.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {includeNew && newCount > 0
              ? t("discovered.clear.descriptionWithNew")
              : t("discovered.clear.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {newCount > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeNew}
              onChange={(e) => onIncludeNewChange(e.target.checked)}
            />
            {t("discovered.clear.alsoNew", { count: newCount })}
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>
            {t("shared.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={clearing}
            onClick={(e) => {
              e.preventDefault();
              handleClear();
            }}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("shared.delete")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
