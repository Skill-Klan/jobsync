"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createTask, updateTask } from "@/actions/task.actions";
import { Loader, PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { useEffect, useTransition } from "react";
import { AddTaskFormSchema } from "@/models/addTaskForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Task, TASK_STATUSES, TaskStatus } from "@/models/task.model";
import { z } from "zod";
import { toastActionResult } from "@/lib/toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import SelectFormCtrl from "../Select";
import { DatePicker } from "../DatePicker";
import TiptapEditor from "../TiptapEditor";
import { Input } from "../ui/input";
import { Combobox } from "../ComboBox";
import { Slider } from "../ui/slider";
import { ActivityType } from "@/models/activity.model";
import { useFormatDate, useTranslations } from "@/i18n/client";
import { DATE_PATTERNS } from "@/i18n/dates";

type TaskFormProps = {
  activityTypes: ActivityType[];
  editTask?: Task | null;
  resetEditTask: () => void;
  onTaskSaved: () => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  onSaveAndStart?: (taskId: string) => void;
};

export function TaskForm({
  activityTypes,
  editTask,
  resetEditTask,
  onTaskSaved,
  dialogOpen,
  setDialogOpen,
  onSaveAndStart,
}: TaskFormProps) {
  const t = useTranslations("tasks");
  const formatDate = useFormatDate();
  const statusOptions = (Object.keys(TASK_STATUSES) as TaskStatus[]).map(
    (value) => ({ id: value, label: t(`status.${value}`), value }),
  );
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof AddTaskFormSchema>>({
    resolver: zodResolver(AddTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "in-progress" as TaskStatus,
      priority: 5,
      percentComplete: 0,
      dueDate: undefined,
      activityTypeId: undefined,
    },
  });

  const { reset, watch } = form;

  const priorityValue = watch("priority");
  const percentCompleteValue = watch("percentComplete");

  useEffect(() => {
    if (editTask) {
      reset({
        id: editTask.id,
        userId: editTask.userId,
        title: editTask.title,
        description: editTask.description || "",
        status: editTask.status,
        priority: editTask.priority,
        percentComplete: editTask.percentComplete,
        dueDate: editTask.dueDate ? new Date(editTask.dueDate) : undefined,
        activityTypeId: editTask.activityTypeId || undefined,
      });
    } else {
      reset({
        title: "",
        description: "",
        status: "in-progress",
        priority: 5,
        percentComplete: 0,
        dueDate: undefined,
        activityTypeId: undefined,
      });
    }
  }, [editTask, reset]);

  function onSubmit(
    data: z.infer<typeof AddTaskFormSchema>,
    startAfterSave = false,
  ) {
    startTransition(async () => {
      const result = editTask ? await updateTask(data) : await createTask(data);
      toastActionResult<Task>(result, {
        success: editTask ? t("form.updated") : t("form.created"),
        onSuccess: (task) => {
          reset();
          setDialogOpen(false);
          resetEditTask();
          onTaskSaved();
          if (startAfterSave && task?.id) {
            onSaveAndStart?.(task.id);
          }
        },
      });
    });
  }

  const onSaveClick = form.handleSubmit((data) => onSubmit(data, false));
  const onSaveAndStartClick = form.handleSubmit((data) =>
    onSubmit(data, true),
  );

  const pageTitle = editTask ? t("form.editTitle") : t("form.addTitle");
  const pageDescription = editTask
    ? t("form.editDescription")
    : t("form.addDescription");

  const closeDialog = () => {
    reset();
    resetEditTask();
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogOverlay>
        <DialogContent className="sm:max-w-[725px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="task-form-dialog-title">
              {pageTitle}
            </DialogTitle>
            <DialogDescription>{pageDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={onSaveClick}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4"
            >
              {/* Title */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.title")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("form.titlePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Activity Type */}
              <div>
                <FormField
                  control={form.control}
                  name="activityTypeId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.activityType")}</FormLabel>
                      <FormControl>
                        <Combobox
                          options={activityTypes}
                          field={{
                            ...field,
                            name: "activityType",
                          }}
                          creatable
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status */}
              <div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.status")}</FormLabel>
                      <SelectFormCtrl
                        label={t("form.statusSelect")}
                        options={statusOptions}
                        field={field}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Priority */}
              <div>
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.priority", { value: priorityValue })}</FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="mt-2"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("form.priorityLow")}</span>
                        <span>{t("form.priorityHigh")}</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Percent Complete */}
              <div>
                <FormField
                  control={form.control}
                  name="percentComplete"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        {t("form.percentComplete", { value: percentCompleteValue })}
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="mt-2"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Due Date */}
              <div>
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.dueDate")}</FormLabel>
                      <DatePicker
                        field={field}
                        presets={true}
                        isEnabled={true}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Created and Updated Dates */}
              {editTask && (
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-medium">{t("form.createdAt")}</p>
                    <p className="text-sm text-muted-foreground">
                      {editTask.createdAt
                        ? formatDate(
                            new Date(editTask.createdAt),
                            DATE_PATTERNS.dateTime,
                          )
                        : t("form.notAvailable")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("form.updatedAt")}</p>
                    <p className="text-sm text-muted-foreground">
                      {editTask.updatedAt
                        ? formatDate(
                            new Date(editTask.updatedAt),
                            DATE_PATTERNS.dateTime,
                          )
                        : t("form.notAvailable")}
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("form.description")}</FormLabel>
                      <FormControl>
                        <TiptapEditor field={field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <DialogFooter>
                  <div>
                    <Button
                      type="reset"
                      variant="outline"
                      className="mt-2 md:mt-0 w-full"
                      onClick={closeDialog}
                    >
                      {t("form.cancel")}
                    </Button>
                  </div>
                  {onSaveAndStart && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-2 md:mt-0"
                      onClick={onSaveAndStartClick}
                      disabled={isPending}
                      data-testid="save-and-start-task-btn"
                    >
                      {t("form.saveAndStart")}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isPending}
                    data-testid="save-task-btn"
                  >
                    {t("form.save")}
                    {isPending && (
                      <Loader className="h-4 w-4 shrink-0 spinner ml-2" />
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </Form>
        </DialogContent>
      </DialogOverlay>
    </Dialog>
  );
}
