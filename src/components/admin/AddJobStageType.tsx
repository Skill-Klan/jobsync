"use client";
import { useMemo, useTransition, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import SelectFormCtrl from "../Select";
import { toastActionResult } from "@/lib/toast";
import { JobStageTypeRef } from "@/models/jobStage.model";
import { JobStatus } from "@/models/job.model";
import {
  createJobStageType,
  updateJobStageType,
} from "@/actions/jobStageType.actions";
import { useLabel, useTranslations } from "@/i18n/client";

// Built per render language: the messages are what the form shows.
const addJobStageTypeFormSchema = (m: {
  required: string;
  empty: string;
  tooLong: string;
  statusRequired: string;
  statusPick: string;
}) =>
  z.object({
    label: z
      .string({ error: m.required })
      .min(1, { message: m.empty })
      .max(80, { message: m.tooLong }),
    statusId: z
      .string({ error: m.statusRequired })
      .min(1, { message: m.statusPick }),
  });

type AddJobStageTypeFormValues = z.infer<
  ReturnType<typeof addJobStageTypeFormSchema>
>;

type AddJobStageTypeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: JobStageTypeRef | null;
  statuses: JobStatus[];
  reloadTypes: () => void;
};

function AddJobStageType({
  open,
  onOpenChange,
  type,
  statuses,
  reloadTypes,
}: AddJobStageTypeProps) {
  const t = useTranslations("library");
  const label = useLabel();
  const [isPending, startTransition] = useTransition();
  const schema = useMemo(
    () =>
      addJobStageTypeFormSchema({
        required: t("stages.required"),
        empty: t("stages.empty"),
        tooLong: t("stages.tooLong"),
        statusRequired: t("stages.statusRequired"),
        statusPick: t("stages.statusPick"),
      }),
    [t],
  );

  const form = useForm<AddJobStageTypeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", statusId: "" },
  });

  const { reset } = form;

  // A custom stage is most often an interview round, so that is the default.
  useEffect(() => {
    if (!open) return;
    reset({
      label: type?.label ?? "",
      statusId:
        type?.statusId ??
        statuses.find((s) => s.value === "interview")?.id ??
        "",
    });
  }, [open, type, statuses, reset]);

  const onSubmit = (values: AddJobStageTypeFormValues) => {
    startTransition(async () => {
      const res = type
        ? await updateJobStageType(
            type.id,
            values.label,
            values.statusId,
            type.sortOrder,
          )
        : await createJobStageType(values.label, values.statusId);
      toastActionResult(res, {
        success: type ? t("stages.updated") : t("stages.added"),
        onSuccess: () => {
          onOpenChange(false);
          reset();
          reloadTypes();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type ? t("stages.editTitle") : t("stages.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("stages.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("stages.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("stages.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("stages.parentStatus")}</FormLabel>
                  <SelectFormCtrl
                    label={t("stages.statusSelect")}
                    options={statuses.map((status) => ({
                      ...status,
                      label: label("jobStatus", status),
                    }))}
                    field={field}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("shared.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {t("shared.save")}
                {isPending && (
                  <Loader className="ml-2 h-4 w-4 shrink-0 spinner" />
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddJobStageType;
