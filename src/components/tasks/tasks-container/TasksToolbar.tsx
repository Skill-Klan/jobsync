"use client";
import { useEffect, useState } from "react";
import { Filter, ListFilter, PlusCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { CardTitle } from "../../ui/card";
import { ResponsiveCardHeader } from "../../ResponsiveCardHeader";
import { SearchInput } from "../../SearchInput";
import { RecordsCount } from "../../RecordsCount";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { TaskGroupBy, TaskStatus, TASK_STATUSES } from "@/models/task.model";
import { useTranslations } from "@/i18n/client";

// Presentational: the Tasks card header — title/count, search, status
// filter dropdown, group-by select, and New Task.
export function TasksToolbar({
  tasksCount,
  totalTasks,
  initialLoading,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onToggleStatusFilter,
  groupBy,
  onGroupByChange,
  onAddTask,
}: {
  tasksCount: number;
  totalTasks: number;
  initialLoading: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: TaskStatus[];
  onToggleStatusFilter: (status: TaskStatus) => void;
  groupBy: TaskGroupBy;
  onGroupByChange: (value: string) => void;
  onAddTask: () => void;
}) {
  const t = useTranslations("tasks");
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ResponsiveCardHeader>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <CardTitle>{t("toolbar.title")}</CardTitle>
        {!initialLoading && totalTasks > 0 && (
          <RecordsCount count={tasksCount} total={totalTasks} label={t("toolbar.recordsLabel")} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
        <SearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          placeholder={t("toolbar.searchPlaceholder")}
        />
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t("toolbar.status")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("toolbar.filterByStatus")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={() => onToggleStatusFilter(status)}
                >
                  {t(`status.${status}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Filter className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              {t("toolbar.status")}
            </span>
          </Button>
        )}
        {mounted ? (
          <Select value={groupBy} onValueChange={onGroupByChange}>
            <SelectTrigger className="w-[140px] h-8">
              <ListFilter className="h-3.5 w-3.5" />
              <SelectValue placeholder={t("toolbar.groupBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("toolbar.groupBy")}</SelectLabel>
                <SelectSeparator />
                <SelectItem value="none">{t("toolbar.groupNone")}</SelectItem>
                <SelectItem value="createdDate">{t("toolbar.groupCreatedDate")}</SelectItem>
                <SelectItem value="dueDate">{t("toolbar.groupDueDate")}</SelectItem>
                <SelectItem value="updatedDate">{t("toolbar.groupUpdatedDate")}</SelectItem>
                <SelectItem value="activityType">{t("toolbar.groupActivityType")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1 w-[140px]">
            <ListFilter className="h-3.5 w-3.5" />
            <span>{t("toolbar.groupBy")}</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={onAddTask}
          data-testid="add-task-btn"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            {t("toolbar.newTask")}
          </span>
        </Button>
      </div>
    </ResponsiveCardHeader>
  );
}
