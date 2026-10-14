"use client";
import { CirclePlay, MoreVertical, Trash } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Activity, ActivityType } from "@/models/activity.model";
import { deleteActivityById } from "@/actions/activity.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { useMemo, useState } from "react";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { useFormatDate, useTranslations } from "@/i18n/client";
import type { DatePattern } from "@/i18n/dates";

// English keeps the locale tokens the table always used ("PP" = Oct 14, 2026,
// "p" = 3:05 PM); Ukrainian puts the day first and uses 24-hour time.
const DAY: DatePattern = { en: "PP", uk: "d MMM yyyy" };
const TIME: DatePattern = { en: "p", uk: "HH:mm" };

interface ActivitiesTableProps {
  activities: Activity[];
  reloadActivities: () => void;
  onStartActivity: (activityId: string) => void;
}

function ActivitiesTable({
  activities,
  reloadActivities,
  onStartActivity,
}: ActivitiesTableProps) {
  const t = useTranslations("activities");
  const formatDate = useFormatDate();
  const [alertOpen, setAlertOpen] = useState(false);
  const [activityIdToDelete, setActivityIdToDelete] = useState<string>();
  const calculateDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return totalMinutes === 0
      ? t("table.durationZero")
      : t("table.durationValue", { hours, minutes });
  };

  const onDeleteActivity = useMemo(
    () => (id: string) => {
      setAlertOpen(true);
      setActivityIdToDelete(id);
    },
    [],
  );

  const deleteActivity = async () => {
    const { success, message } = await deleteActivityById(activityIdToDelete!);
    if (success) {
      toastSuccess(t("table.deleted"));
      reloadActivities();
    } else {
      toastError(message);
    }
  };
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden md:table-cell">{t("table.date")}</TableHead>
            <TableHead>{t("table.activity")}</TableHead>
            <TableHead className="whitespace-nowrap">
              {t("table.project")}
              <br />
              {t("table.projectHint")}
            </TableHead>
            <TableHead className="hidden md:table-cell whitespace-nowrap">
              {t("table.startTime")}
            </TableHead>
            <TableHead className="hidden md:table-cell whitespace-nowrap">
              {t("table.endTime")}
            </TableHead>
            <TableHead>{t("table.duration")}</TableHead>
            <TableHead>
              <span>{t("table.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities?.map((activity: Activity) => {
            return (
              <TableRow
                key={activity.id}
                className="cursor-pointer group relative"
              >
                <TableCell className="hidden md:table-cell w-[120px]">
                  {activity.startTime
                    ? formatDate(activity.startTime, DAY)
                    : t("table.notAvailable")}
                </TableCell>
                <TableCell className="font-medium">
                  {activity.activityName}
                </TableCell>
                <TableCell className="font-medium">
                  {(activity.activityType as ActivityType)?.label}
                </TableCell>
                <TableCell className="hidden md:table-cell whitespace-nowrap">
                  {formatDate(activity.startTime, TIME)}
                </TableCell>
                <TableCell className="hidden md:table-cell whitespace-nowrap">
                  {formatDate(activity.endTime!, TIME)}
                </TableCell>
                <TableCell>
                  {activity.startTime &&
                    activity.endTime &&
                    calculateDuration(activity.duration ?? 0)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center flex-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">{t("table.toggleMenu")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuLabel>{t("table.actions")}</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            className="cursor-pointer text-green-600"
                            onClick={() => onStartActivity(activity.id!)}
                          >
                            <CirclePlay className="mr-2 h-4 w-4" />
                            {t("table.startActivity")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 cursor-pointer"
                            onClick={() => onDeleteActivity(activity.id!)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            {t("table.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      title={t("table.startActivity")}
                      aria-haspopup="true"
                      size="icon"
                      variant="ghost"
                      onClick={() => onStartActivity(activity.id!)}
                      className="opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-300"
                    >
                      <span>
                        <CirclePlay className="text-green-600" />
                      </span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={t("table.deleteItem")}
        open={alertOpen}
        onOpenChange={setAlertOpen}
        onDelete={deleteActivity}
      />
    </>
  );
}

export default ActivitiesTable;
