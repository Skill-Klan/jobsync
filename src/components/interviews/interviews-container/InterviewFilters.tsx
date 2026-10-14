"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InterviewFilterOption } from "@/models/interview.model";
import type { JobStageTypeRef } from "@/models/jobStage.model";
import { useLabel, useTranslations } from "@/i18n/client";

// Select cannot hold an empty-string value, so all-of-them gets a sentinel
const ALL = "all";

type Props = {
  rounds: InterviewFilterOption[];
  companies: InterviewFilterOption[];
  // The rounds carry only id and label; the stage type gives the value the
  // shared labels dictionary is keyed on.
  stageTypes?: JobStageTypeRef[];
  stageTypeId?: string;
  companyId?: string;
  onRoundChange: (id?: string) => void;
  onCompanyChange: (id?: string) => void;
};

export function InterviewFilters({
  rounds,
  companies,
  stageTypes = [],
  stageTypeId,
  companyId,
  onRoundChange,
  onCompanyChange,
}: Props) {
  const t = useTranslations("interviews");
  const label = useLabel();
  const roundLabel = (round: InterviewFilterOption) => {
    const type = stageTypes.find((s) => s.id === round.id);
    return type ? label("jobStage", type) : round.label;
  };
  return (
    <>
      <Select
        value={stageTypeId ?? ALL}
        onValueChange={(v) => onRoundChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger aria-label={t("filters.byRound")} className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filters.allRounds")}</SelectItem>
          {rounds.map((round) => (
            <SelectItem key={round.id} value={round.id}>
              {roundLabel(round)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={companyId ?? ALL}
        onValueChange={(v) => onCompanyChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger aria-label={t("filters.byCompany")} className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filters.allCompanies")}</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
