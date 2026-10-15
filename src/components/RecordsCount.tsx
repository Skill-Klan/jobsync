"use client";
import { useTranslations } from "@/i18n/client";

type RecordsCountProps = {
  count: number;
  total?: number;
  // English names the records ("jobs"); Ukrainian shows the numbers only —
  // the noun would have to agree with any total (common.records).
  label?: string;
};

export function RecordsCount({ count, total, label }: RecordsCountProps) {
  const t = useTranslations("common");
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const values = { count, label: label ?? t("records.defaultLabel"), strong };
  return (
    <div className="text-xs text-muted-foreground whitespace-nowrap">
      {total !== undefined
        ? t.rich("records.ofTotal", { ...values, total })
        : t.rich("records.shown", values)}
    </div>
  );
}
