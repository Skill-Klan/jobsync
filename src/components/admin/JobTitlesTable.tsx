"use client";
import { useState } from "react";
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
import { JobTitle } from "@/models/job.model";
import { Briefcase, MoreVertical, Trash } from "lucide-react";
import Link from "next/link";
import { AlertDialog } from "@/models/alertDialog.model";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { deleteJobTitleById } from "@/actions/jobtitle.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { useTranslations } from "@/i18n/client";

type JobTitlesTableProps = {
  jobTitles: JobTitle[];
  reloadJobTitles: () => void;
};

function JobTitlesTable({ jobTitles, reloadJobTitles }: JobTitlesTableProps) {
  const t = useTranslations("library");
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteJobTitle = (title: JobTitle) => {
    const totalJobs = title._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: t("shared.associatedJobs"),
        description: t("jobTitles.blocked", { count: totalJobs }),
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: title.id,
      });
    }
  };
  const deleteJobTitle = async (titleId: string) => {
    if (titleId) {
      const { success, message } = await deleteJobTitleById(titleId);
      if (success) {
        toastSuccess(t("jobTitles.deleted"));
        reloadJobTitles();
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
            <TableHead>{t("jobTitles.header")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("shared.value")}</TableHead>
            <TableHead>{t("shared.totalJobs")}</TableHead>
            <TableHead>{t("shared.jobsApplied")}</TableHead>
            <TableHead>{t("shared.actions")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("shared.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobTitles.map((title: JobTitle) => {
            return (
              <TableRow key={title.id}>
                <TableCell className="font-medium">{title.label}</TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {title.value}
                </TableCell>
                <TableCell className="font-medium">
                  {title._count?.jobsTotal ? (
                    <Link
                      href={`/dashboard/myjobs?title=${encodeURIComponent(title.value)}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {title._count.jobsTotal}
                    </Link>
                  ) : (
                    (title._count?.jobsTotal ?? 0)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {title._count?.jobs ? (
                    <Link
                      href={`/dashboard/myjobs?title=${encodeURIComponent(title.value)}&applied=true`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {title._count.jobs}
                    </Link>
                  ) : (
                    (title._count?.jobs ?? 0)
                  )}
                </TableCell>
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
                      {title._count?.jobs ? (
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link
                            href={`/dashboard/myjobs?title=${encodeURIComponent(title.value)}&applied=true`}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            {t("shared.viewJobs")}
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteJobTitle(title)}
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
        pageTitle={t("jobTitles.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteJobTitle(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default JobTitlesTable;
