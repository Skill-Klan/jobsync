"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Building2,
  MapPin,
  Check,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { DiscoveredJob } from "@/models/automation.model";
import type { JobMatchData } from "@/models/ai.schemas";
import { getWorkplaceTypeLabel } from "@/models/job.model";
import { formatUrl } from "@/lib/utils";
import {
  acceptDiscoveredJob,
  dismissDiscoveredJob,
  analyzeDiscoveredJob,
} from "@/actions/automation.actions";
import { MatchDetails } from "./MatchDetails";
import { PrerankBreakdown } from "./PrerankBreakdown";
import { TipTapContentViewer } from "@/components/TipTapContentViewer";
import { CircularScore } from "@/components/CircularScore";
import { useLabel, useTranslations } from "@/i18n/client";

interface DiscoveredJobDetailProps {
  job: DiscoveredJob | null;
  matchData: JobMatchData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function DiscoveredJobDetail({
  job,
  matchData,
  open,
  onOpenChange,
  onRefresh,
}: DiscoveredJobDetailProps) {
  const t = useTranslations("automations");
  const label = useLabel();
  const [loadingAction, setLoadingAction] = useState<
    "accept" | "dismiss" | "analyze" | null
  >(null);

  if (!job) return null;

  const analyzed = matchData?.analyzed !== false;

  const handleAnalyze = async () => {
    setLoadingAction("analyze");
    try {
      const result = await analyzeDiscoveredJob(job.id);
      if (result.success) {
        toastSuccess(
          t("discovered.toasts.analyzed"),
          t("discovered.toasts.analyzedTitle"),
        );
        onOpenChange(false);
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError(t("discovered.toasts.analyzeFailed"));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAccept = async () => {
    setLoadingAction("accept");
    try {
      const result = await acceptDiscoveredJob(job.id);
      if (result.success) {
        toastSuccess(
          t("discovered.toasts.accepted"),
          t("discovered.toasts.acceptedTitle"),
        );
        onOpenChange(false);
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError(t("discovered.toasts.acceptFailed"));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDismiss = async () => {
    setLoadingAction("dismiss");
    try {
      const result = await dismissDiscoveredJob(job.id);
      if (result.success) {
        toastSuccess(t("discovered.toasts.dismissed"));
        onOpenChange(false);
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError(t("discovered.toasts.dismissFailed"));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{job.JobTitle.label}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-start gap-x-4 gap-y-1">
                <span className="flex items-start gap-1">
                  <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
                  {job.Company.label}
                </span>
                <span className="flex items-start gap-1">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  {job.Location?.label || t("shared.notAvailable")}
                </span>
                {job.workplaceType && (
                  <Badge variant="outline">
                    {getWorkplaceTypeLabel(job.workplaceType, job.workplaceType)}
                  </Badge>
                )}
              </DialogDescription>
            </div>
            {analyzed ? (
              job.matchScore != null && (
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <CircularScore score={job.matchScore} size="md" />
                  <span className="text-xs text-muted-foreground">
                    {t("discovered.detail.aiMatch")}
                  </span>
                </div>
              )
            ) : (
              <Button
                variant="outline"
                onClick={handleAnalyze}
                disabled={loadingAction !== null}
                className="shrink-0"
              >
                {loadingAction === "analyze" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {t("discovered.detail.analyzeMatch")}
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {job.jobUrl && (
              <div>
                <span className="font-semibold mr-2">
                  {t("discovered.detail.jobUrl")}
                </span>
                <a
                  href={formatUrl(job.jobUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {job.jobUrl}
                </a>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {label("discoveryStatus", { value: job.discoveryStatus })}
              </Badge>
              {job.automation && (
                <span className="text-sm text-muted-foreground">
                  {t("discovered.detail.from", { name: job.automation.name })}
                </span>
              )}
            </div>

            {matchData?.prerankScore != null && (
              <PrerankBreakdown
                prerankScore={matchData.prerankScore}
                components={matchData.prerankComponents}
              />
            )}

            <div>
              <h4 className="font-medium mb-2">
                {t("discovered.detail.description")}
              </h4>
              <div className="text-sm text-muted-foreground">
                <TipTapContentViewer content={job.description ?? ""} />
              </div>
            </div>

            <MatchDetails matchData={matchData} discoveredAt={job.discoveredAt} />
          </div>
        </ScrollArea>

        {job.discoveryStatus === "new" && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              disabled={loadingAction !== null}
            >
              {loadingAction === "dismiss" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {t("discovered.detail.dismiss")}
            </Button>
            <Button onClick={handleAccept} disabled={loadingAction !== null}>
              {loadingAction === "accept" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t("discovered.detail.accept")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
