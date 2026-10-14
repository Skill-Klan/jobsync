"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { CircularScore } from "@/components/CircularScore";
import { getDiscoveryStatusBadgeColor } from "@/lib/badge-colors";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Check,
  X,
  ExternalLink,
  Building2,
  MapPin,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { DiscoveredJob } from "@/models/automation.model";
import { getWorkplaceTypeLabel } from "@/models/job.model";
import { isAnalyzed, getPrerankPercent } from "./matchData";
import { useFormatDate, useLabel, useTranslations } from "@/i18n/client";
import { DATE_PATTERNS } from "@/i18n/dates";

interface DiscoveredJobRowProps {
  job: DiscoveredJob;
  isLoading: boolean;
  runInProgress: boolean;
  onViewDetails?: (job: DiscoveredJob) => void;
  onAnalyze: (jobId: string) => void;
  onAccept: (job: DiscoveredJob) => void;
  onDismiss: (jobId: string) => void;
}

export function DiscoveredJobRow({
  job,
  isLoading,
  runInProgress,
  onViewDetails,
  onAnalyze,
  onAccept,
  onDismiss,
}: DiscoveredJobRowProps) {
  const t = useTranslations("automations");
  const label = useLabel();
  const formatDate = useFormatDate();
  const analyzed = isAnalyzed(job);
  const prerankPercent = getPrerankPercent(job);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className="font-medium hover:underline cursor-pointer"
            onClick={() => onViewDetails?.(job)}
          >
            {job.JobTitle.label}
          </span>
          {job.jobUrl && (
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {job.Company.label}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {job.Location?.label || t("shared.notAvailable")}
          {job.workplaceType && (
            <Badge variant="outline" className="text-xs">
              {getWorkplaceTypeLabel(job.workplaceType, job.workplaceType)}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {prerankPercent != null ? (
          <span
            className="font-mono text-sm text-muted-foreground"
            title={t("discovered.row.prerankTitle")}
          >
            {prerankPercent}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {analyzed ? (
          <CircularScore
            score={job.matchScore}
            size="sm"
            animate={false}
            className="mx-auto"
          />
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAnalyze(job.id)}
            disabled={isLoading || runInProgress}
            title={
              runInProgress ? t("discovered.row.runInProgress") : undefined
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {t("discovered.row.analyze")}
              </>
            )}
          </Button>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge
          label={label("discoveryStatus", { value: job.discoveryStatus })}
          color={getDiscoveryStatusBadgeColor(job.discoveryStatus)}
        />
      </TableCell>
      <TableCell>
        {formatDate(new Date(job.discoveredAt), DATE_PATTERNS.date)}
      </TableCell>
      <TableCell className="text-right">
        {job.discoveryStatus === "new" && (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAccept(job)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(job.id)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
