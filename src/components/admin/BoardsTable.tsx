"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  setCompanyWatched,
  watchBoardCompany,
} from "@/actions/company.actions";
import { companyBoardUrl } from "@/lib/atsBoardUrl";
import { toastError, toastSuccess } from "@/lib/toast";
import { PROVIDER_META } from "@/components/automations/ats-search-step/types";
import type { JobBoard, LeverCompany } from "@/models/automation.model";
import type { PendingMerge } from "./WatchMergeDialog";
import { useTranslations } from "@/i18n/client";

type BoardsTableProps = {
  provider: JobBoard;
  rows: LeverCompany[];
  watchedMap: Map<string, string>;
  onWatched: (token: string, companyId: string) => void;
  onUnwatched: (token: string) => void;
  onNeedsMerge: (pending: PendingMerge) => void;
};

function BoardsTable({
  provider,
  rows,
  watchedMap,
  onWatched,
  onUnwatched,
  onNeedsMerge,
}: BoardsTableProps) {
  const t = useTranslations("library");
  const [busy, setBusy] = useState<string | null>(null);

  const watch = async (row: LeverCompany) => {
    setBusy(row.token);
    // Optimistic: the id is unknown until the write returns, so a placeholder
    // holds the cell in its watched state and is replaced on success.
    onWatched(row.token, "");
    const res = await watchBoardCompany(provider, row);
    setBusy(null);

    if (res.success) {
      onWatched(row.token, res.data.companyId);
      toastSuccess(t("companies.added", { name: row.name }));
      return;
    }
    onUnwatched(row.token);
    if ("needsConfirm" in res) {
      onNeedsMerge({ provider, board: row, existing: res.existing });
      return;
    }
    toastError(res.message);
  };

  const unwatch = async (row: LeverCompany) => {
    const companyId = watchedMap.get(row.token);
    if (!companyId) return;
    setBusy(row.token);
    onUnwatched(row.token);
    const res = await setCompanyWatched(companyId, false);
    setBusy(null);

    if (res.success) {
      toastSuccess(t("companies.removed", { name: row.name }));
    } else {
      onWatched(row.token, companyId);
      toastError(res.message);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("board.name")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("board.token")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("board.provider")}</TableHead>
          <TableHead className="text-right">{t("board.watchHeader")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const watched = watchedMap.has(row.token);
          return (
            <TableRow key={row.token}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-1.5">
                  {row.name}
                  <a
                    href={companyBoardUrl(provider, row)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("board.openAria", { name: row.name })}
                    title={t("board.open")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {row.token}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {PROVIDER_META[provider].label}
              </TableCell>
              <TableCell className="text-right">
                {watched ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy === row.token}
                    aria-label={t("board.unwatchAria", { name: row.name })}
                    onClick={() => unwatch(row)}
                    className="group text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="h-3.5 w-3.5 group-hover:hidden" />
                    <span className="group-hover:hidden">{t("board.watching")}</span>
                    <span className="hidden group-hover:inline">{t("board.unwatch")}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === row.token}
                    aria-label={t("board.watchAria", { name: row.name })}
                    onClick={() => watch(row)}
                  >
                    {t("board.watch")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default BoardsTable;
