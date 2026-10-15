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
import { JobStageTypeRef } from "@/models/jobStage.model";
import { ArrowDown, ArrowUp, MoreVertical, Pencil, Trash } from "lucide-react";
import { AlertDialog } from "@/models/alertDialog.model";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { StatusBadge } from "../StatusBadge";
import { getJobStatusBadgeColor } from "@/lib/badge-colors";
import {
  deleteJobStageTypeById,
  updateJobStageType,
} from "@/actions/jobStageType.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { useLabel, useTranslations } from "@/i18n/client";

type JobStagesTableProps = {
  types: JobStageTypeRef[];
  reloadTypes: () => void;
  onEdit: (type: JobStageTypeRef) => void;
};

function JobStagesTable({ types, reloadTypes, onEdit }: JobStagesTableProps) {
  const t = useTranslations("library");
  const label = useLabel();
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteType = (type: JobStageTypeRef) => {
    const stages = type._count?.stages ?? 0;
    if (stages > 0) {
      setAlert({
        openState: true,
        title: t("stages.inUseTitle"),
        description: t("stages.inUse", { count: stages }),
        deleteAction: false,
      });
    } else {
      setAlert({ openState: true, deleteAction: true, itemId: type.id });
    }
  };

  const deleteType = async (typeId: string) => {
    if (typeId) {
      const { success, message } = await deleteJobStageTypeById(typeId);
      if (success) {
        toastSuccess(t("stages.deleted"));
        reloadTypes();
      } else {
        toastError(message);
      }
    }
  };

  // Swap sortOrder with the adjacent row rather than renumbering the list:
  // a drag-and-drop reorder would need a new dependency.
  const move = async (index: number, direction: -1 | 1) => {
    const type = types[index];
    const neighbour = types[index + direction];
    if (!neighbour) return;

    const results = await Promise.all([
      updateJobStageType(
        type.id,
        type.label,
        type.statusId,
        neighbour.sortOrder,
      ),
      updateJobStageType(
        neighbour.id,
        neighbour.label,
        neighbour.statusId,
        type.sortOrder,
      ),
    ]);
    const failed = results.find((res) => !res?.success);
    if (failed) {
      toastError(failed.message);
    }
    reloadTypes();
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("stages.stage")}</TableHead>
            <TableHead>{t("stages.parentStatus")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("stages.order")}</TableHead>
            <TableHead>{t("stages.stagesCount")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("shared.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {types.map((type: JobStageTypeRef, index: number) => {
            return (
              <TableRow key={type.id}>
                <TableCell className="font-medium">
                  {label("jobStage", type)}
                </TableCell>
                <TableCell>
                  {type.Status && (
                    <StatusBadge
                      label={label("jobStatus", type.Status)}
                      color={getJobStatusBadgeColor(type.Status.value)}
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {type.sortOrder}
                </TableCell>
                <TableCell className="font-medium">
                  {type._count?.stages ?? 0}
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
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onEdit(type)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("shared.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" />
                        {t("stages.moveUp")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={index === types.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" />
                        {t("stages.moveDown")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteType(type)}
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
        pageTitle={t("stages.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteType(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default JobStagesTable;
