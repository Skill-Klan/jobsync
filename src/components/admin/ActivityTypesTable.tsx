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
import { MoreVertical, Trash } from "lucide-react";
import { useState } from "react";
import { deleteActivityTypeById } from "@/actions/activity.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";
import { useTranslations } from "@/i18n/client";

type ActivityTypeRow = {
  id: string;
  label: string;
  value: string;
  totalDuration: number;
  _count?: { Activities?: number; Tasks?: number };
};

type ActivityTypesTableProps = {
  activityTypes: ActivityTypeRow[];
  reloadActivityTypes: () => void;
};

function ActivityTypesTable({
  activityTypes,
  reloadActivityTypes,
}: ActivityTypesTableProps) {
  const t = useTranslations("library");
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDelete = (at: ActivityTypeRow) => {
    const activityCount = at._count?.Activities ?? 0;
    const taskCount = at._count?.Tasks ?? 0;

    if (activityCount > 0 || taskCount > 0) {
      const links = [
        activityCount > 0
          ? t("activityTypes.activitiesCount", { count: activityCount })
          : "",
        taskCount > 0 ? t("activityTypes.tasksCount", { count: taskCount }) : "",
      ]
        .filter(Boolean)
        .join(` ${t("shared.and")} `);

      setAlert({
        openState: true,
        title: t("activityTypes.inUseTitle"),
        description: t("activityTypes.inUse", { links }),
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: at.id,
      });
    }
  };

  const deleteType = async (id: string | undefined) => {
    if (!id) return;
    const { success, message } = await deleteActivityTypeById(id);
    if (success) {
      toastSuccess(t("activityTypes.deleted"));
      reloadActivityTypes();
    } else {
      toastError(message);
    }
  };

  const formatHours = (minutes: number) => {
    const hours = minutes / 60;
    return hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("activityTypes.label")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("shared.value")}</TableHead>
            <TableHead>{t("activityTypes.activities")}</TableHead>
            <TableHead>{t("activityTypes.tasks")}</TableHead>
            <TableHead>{t("activityTypes.totalHours")}</TableHead>
            <TableHead>{t("shared.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activityTypes.map((at) => (
            <TableRow key={at.id}>
              <TableCell className="font-medium">{at.label}</TableCell>
              <TableCell className="font-medium hidden sm:table-cell">
                {at.value}
              </TableCell>
              <TableCell className="font-medium">
                {at._count?.Activities ?? 0}
              </TableCell>
              <TableCell className="font-medium">
                {at._count?.Tasks ?? 0}
              </TableCell>
              <TableCell className="font-medium">
                {t("activityTypes.hours", { hours: formatHours(at.totalDuration) })}
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
                      className="text-red-600 cursor-pointer"
                      onClick={() => onDelete(at)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      {t("shared.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={t("activityTypes.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteType(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ActivityTypesTable;
