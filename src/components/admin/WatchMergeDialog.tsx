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
import { PROVIDER_META } from "@/components/automations/ats-search-step/types";
import type { JobBoard } from "@/models/automation.model";
import { useTranslations } from "@/i18n/client";

export type PendingMerge = {
  provider: JobBoard;
  board: { name: string; token: string; host?: "default" | "eu" };
  existing: { id: string; label: string };
};

type Props = {
  pending: PendingMerge | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// There is no "create a separate entry" option: @@unique([value, createdBy])
// forbids a second row with the same canonical value.
export function WatchMergeDialog({ pending, onConfirm, onCancel }: Props) {
  const t = useTranslations("library");
  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("board.linkTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {/* Values default to "" — the dialog keeps rendering while it closes. */}
            {t.rich("board.linkDescription", {
              existing: pending?.existing.label ?? "",
              provider: pending ? PROVIDER_META[pending.provider].label : "",
              token: pending?.board.token ?? "",
              strong: (chunks) => <strong>{chunks}</strong>,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("shared.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("board.linkConfirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
