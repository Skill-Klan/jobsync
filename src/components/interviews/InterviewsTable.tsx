"use client";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import InterviewRow from "./InterviewRow";
import type { InterviewRow as InterviewRowType } from "@/models/interview.model";
import { useTranslations } from "@/i18n/client";

type InterviewsTableProps = {
  interviews: InterviewRowType[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onEdit: (interview: InterviewRowType) => void;
  onChanged: () => void;
};

function InterviewsTable({
  interviews,
  expandedId,
  onToggle,
  onEdit,
  onChanged,
}: InterviewsTableProps) {
  const t = useTranslations("interviews");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <span className="sr-only">{t("table.expand")}</span>
          </TableHead>
          <TableHead>{t("table.when")}</TableHead>
          <TableHead>{t("table.job")}</TableHead>
          <TableHead>{t("table.round")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("table.format")}</TableHead>
          <TableHead className="hidden lg:table-cell">
            {t("table.interviewers")}
          </TableHead>
          <TableHead className="hidden sm:table-cell">{t("table.prep")}</TableHead>
          <TableHead>{t("table.outcome")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("table.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {interviews.map((interview) => (
          <InterviewRow
            key={interview.id}
            interview={interview}
            expanded={expandedId === interview.id}
            onToggle={() => onToggle(interview.id)}
            onEdit={() => onEdit(interview)}
            onOutcomeSaved={onChanged}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export default InterviewsTable;
