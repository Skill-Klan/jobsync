"use client";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Company } from "@/models/job.model";
import {
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { deleteCompanyById, setCompanyWatched } from "@/actions/company.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";
import { BoardCell } from "./BoardCell";
import { useDateFnsLocale, useTranslations } from "@/i18n/client";

type CompaniesTableProps = {
  companies: Company[];
  reloadCompanies: () => void;
  editCompany: (id: string) => void;
  scope?: "mine" | "watchlist";
};

function CompaniesTable({
  companies,
  reloadCompanies,
  editCompany,
  scope = "mine",
}: CompaniesTableProps) {
  const t = useTranslations("library");
  const dateLocale = useDateFnsLocale();
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteCompany = (company: Company) => {
    const totalJobs = company._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: t("shared.associatedJobs"),
        description: [
          t("companies.blockedJobs", { count: totalJobs }),
          t("companies.blockedTail"),
        ].join(" "),
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: company.id,
      });
    }
  };

  const detailsHref = (id: string) =>
    `/dashboard/admin/companies/${id}${scope === "watchlist" ? "?scope=watchlist" : ""}`;

  const toggleWatch = async (company: Company) => {
    const next = !company.watched;
    const res = await setCompanyWatched(company.id, next);
    if (res.success) {
      toastSuccess(
        next
          ? t("companies.added", { name: company.label })
          : t("companies.removedStays", { name: company.label }),
      );
      reloadCompanies();
    } else {
      toastError(res.message);
    }
  };

  const deleteCompany = async (companyId: string | undefined) => {
    if (companyId) {
      const { res, success, message } = await deleteCompanyById(companyId);
      if (success) {
        toastSuccess(t("companies.deleted"));
        reloadCompanies();
      } else {
        toastError(message);
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-[100px] sm:table-cell">
              <span className="sr-only">{t("companies.logo")}</span>
            </TableHead>
            <TableHead>{t("companies.name")}</TableHead>
            {scope === "watchlist" ? (
              <>
                <TableHead>{t("companies.board")}</TableHead>
                <TableHead>{t("companies.jobs")}</TableHead>
                <TableHead>{t("companies.watched")}</TableHead>
              </>
            ) : (
              <>
                <TableHead className="hidden sm:table-cell">{t("shared.value")}</TableHead>
                <TableHead>{t("shared.totalJobs")}</TableHead>
                <TableHead>{t("shared.jobsApplied")}</TableHead>
                <TableHead>{t("companies.rejected")}</TableHead>
                <TableHead>{t("companies.contacts")}</TableHead>
              </>
            )}
            <TableHead>{t("shared.actions")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("shared.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company: Company) => {
            return (
              <TableRow key={company.id}>
                <TableCell className="hidden sm:table-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={t("companies.logoAlt")}
                    className="w-8 h-8 rounded-md object-cover"
                    src={company.logoUrl || "/images/jobsync-logo.svg"}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/jobsync-logo.svg";
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={detailsHref(company.id)}
                      className="hover:underline underline-offset-4"
                    >
                      {company.label}
                    </Link>
                    {company.watched && (
                      <span
                        title={t("companies.onWatchlist")}
                        className="text-emerald-600 dark:text-emerald-400"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {scope !== "watchlist" && company.atsToken && (
                      <BoardCell company={company} />
                    )}
                  </span>
                </TableCell>
                {scope === "watchlist" ? (
                  <>
                    <TableCell>
                      <BoardCell company={company} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsTotal ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.watchedAt
                        ? formatDistanceToNow(new Date(company.watchedAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : "—"}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium hidden sm:table-cell">
                      {company.value}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsTotal ? (
                        <Link
                          href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {company._count.jobsTotal}
                        </Link>
                      ) : (
                        (company._count?.jobsTotal ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsApplied ? (
                        <Link
                          href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}&applied=true`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {company._count.jobsApplied}
                        </Link>
                      ) : (
                        (company._count?.jobsApplied ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsRejected ?? 0}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.contacts ?? 0}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">{t("shared.toggleMenu")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t("shared.actions")}</DropdownMenuLabel>
                      <DropdownMenuItem className="cursor-pointer" asChild>
                        <Link href={detailsHref(company.id)}>
                          <Building2 className="mr-2 h-4 w-4" />
                          {t("companies.viewDetails")}
                        </Link>
                      </DropdownMenuItem>
                      {company._count?.jobsApplied ? (
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link
                            href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}&applied=true`}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            {t("shared.viewJobs")}
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => editCompany(company.id)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("companies.editCompany")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => toggleWatch(company)}
                      >
                        {company.watched ? (
                          <EyeOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        {company.watched ? t("companies.unwatch") : t("companies.watch")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteCompany(company)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        {t("shared.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={t("companies.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteCompany(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default CompaniesTable;
