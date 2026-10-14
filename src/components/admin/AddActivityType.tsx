"use client";
import { useMemo, useTransition, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader, PlusCircle } from "lucide-react";
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
import { toastSuccess, toastError } from "@/lib/toast";
import { createActivityType } from "@/actions/activity.actions";
import { useTranslations } from "@/i18n/client";

// Built per render language: the messages are what the form shows.
const addActivityTypeFormSchema = (m: {
  required: string;
  empty: string;
  tooLong: string;
}) =>
  z.object({
    label: z
      .string({ error: m.required })
      .min(1, { message: m.empty })
      .max(60, { message: m.tooLong }),
  });

type AddActivityTypeFormValues = z.infer<
  ReturnType<typeof addActivityTypeFormSchema>
>;

type AddActivityTypeProps = {
  reloadActivityTypes: () => void;
};

function AddActivityType({ reloadActivityTypes }: AddActivityTypeProps) {
  const t = useTranslations("library");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const schema = useMemo(
    () =>
      addActivityTypeFormSchema({
        required: t("activityTypes.required"),
        empty: t("activityTypes.empty"),
        tooLong: t("activityTypes.tooLong"),
      }),
    [t],
  );

  const form = useForm<AddActivityTypeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "" },
  });

  const { reset } = form;

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: AddActivityTypeFormValues) => {
    startTransition(async () => {
      try {
        await createActivityType(values.label);
        toastSuccess(t("activityTypes.added"));
        setDialogOpen(false);
        reset();
        reloadActivityTypes();
      } catch {
        toastError(t("activityTypes.addFailed"));
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={openDialog}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          {t("activityTypes.newType")}
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("activityTypes.addTitle")}</DialogTitle>
            <DialogDescription>
              {t("activityTypes.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("activityTypes.nameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("activityTypes.namePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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
    </>
  );
}

export default AddActivityType;
