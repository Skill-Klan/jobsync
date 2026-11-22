"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "@/i18n/client";
import { nextSort, sortRows, type SortDirection, type SortKey, type TableRow } from "./usageSort";

// The people list: the longest quiet first (last sign-in, oldest on top) until
// another column header is clicked; and again to flip.
export default function UsageTable({ rows }: { rows: TableRow[] }) {
  const t = useTranslations("stats");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "lastSignIn", direction: "asc" });
  const shown = useMemo(() => sortRows(rows, sort.key, sort.direction), [rows, sort]);

  const header = (key: SortKey, label: string, align: "left" | "right") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={`py-2 pr-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          onClick={() => setSort(nextSort(sort, key))}
          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        >
          {label}
          <Icon className="h-3 w-3" aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {header("name", t("name"), "left")}
            {header("lastSignIn", t("lastSignIn"), "left")}
            {header("jobs", t("jobs"), "right")}
            {header("resumes", t("resumes"), "right")}
            {header("modules", t("modules"), "right")}
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2 pr-3">{p.name}</td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {p.lastSignInLabel ?? <span className="text-muted-foreground">{t("never")}</span>}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{p.jobs}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {t("resumesCell", { total: p.resumes, withFile: p.resumesWithFile })}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                {p.modulesTotal > 0 ? (
                  t("modulesCell", { closed: p.modulesClosed, total: p.modulesTotal })
                ) : (
                  <span className="text-muted-foreground">{t("noPlan")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
