"use client";

import { useState, useEffect } from "react";
import { toastSuccess, toastError } from "@/lib/toast";
import type { DiscoveredJob } from "@/models/automation.model";
import {
  acceptDiscoveredJob,
  dismissDiscoveredJob,
  analyzeDiscoveredJob,
} from "@/actions/automation.actions";
import { useTranslations } from "@/i18n/client";

// Per-job analyze/accept/dismiss, serialized through a single loading id so the
// parent can also block starting a run while one is in flight.
export function useDiscoveredJobActions(
  onRefresh: () => void,
  onBusyChange?: (busy: boolean) => void,
) {
  const t = useTranslations("automations");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(loadingAction !== null);
  }, [loadingAction, onBusyChange]);

  const handleAnalyze = async (jobId: string) => {
    setLoadingAction(jobId);
    try {
      const result = await analyzeDiscoveredJob(jobId);
      if (result.success) {
        toastSuccess(
          t("discovered.toasts.analyzed"),
          t("discovered.toasts.analyzedTitle"),
        );
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

  const handleAccept = async (job: DiscoveredJob) => {
    setLoadingAction(job.id);
    try {
      const result = await acceptDiscoveredJob(job.id);
      if (result.success) {
        toastSuccess(
          t("discovered.toasts.accepted"),
          t("discovered.toasts.acceptedTitle"),
        );
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

  const handleDismiss = async (jobId: string) => {
    setLoadingAction(jobId);
    try {
      const result = await dismissDiscoveredJob(jobId);
      if (result.success) {
        toastSuccess(t("discovered.toasts.dismissed"));
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

  return { loadingAction, handleAnalyze, handleAccept, handleDismiss };
}
