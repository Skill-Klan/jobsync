"use client";
import { AlertTriangle, Loader, Sparkles } from "lucide-react";
import { Button } from "../../ui/button";
import { Card, CardHeader } from "../../ui/card";
import type { PendingCard } from "./pendingCards";
import { PendingCardRow } from "./PendingCardRow";
import { useTranslations } from "@/i18n/client";

export function ImportReviewBanner({
  pendingCards,
  isStructuring,
  importTruncated,
  unrecognizedSections,
  onAccept,
  onDiscard,
  onDiscardImport,
}: {
  pendingCards: PendingCard[];
  isStructuring: boolean;
  importTruncated: boolean;
  unrecognizedSections: string[];
  onAccept: (id: string) => void;
  onDiscard: (id: string) => void;
  onDiscardImport: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium flex items-center gap-2">
              {isStructuring ? (
                <>
                  <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                  {t("importReview.structuring")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  {t("importReview.prefilled")}
                  {importTruncated && ` ${t("importReview.truncated")}`}
                </>
              )}
            </p>
            {unrecognizedSections.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("importReview.unrecognized", {
                  sections: unrecognizedSections.join(", "),
                })}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onDiscardImport}
          >
            {t("resumeDialogs.discardImport")}
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {pendingCards.map((pending) => (
            <PendingCardRow
              key={pending.id}
              pending={pending}
              onAccept={onAccept}
              onDiscard={onDiscard}
              locked={isStructuring}
            />
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
