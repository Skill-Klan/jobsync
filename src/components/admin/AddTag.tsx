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
import { createTag } from "@/actions/tag.actions";
import { useTranslations } from "@/i18n/client";

// Built per render language: the messages are what the form shows.
const addTagFormSchema = (m: { required: string; empty: string; tooLong: string }) =>
  z.object({
    label: z
      .string({ error: m.required })
      .min(1, { message: m.empty })
      .max(60, { message: m.tooLong }),
  });

type AddTagFormValues = z.infer<ReturnType<typeof addTagFormSchema>>;

type AddTagProps = {
  reloadTags: () => void;
};

function AddTag({ reloadTags }: AddTagProps) {
  const t = useTranslations("library");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const schema = useMemo(
    () =>
      addTagFormSchema({
        required: t("skills.required"),
        empty: t("skills.empty"),
        tooLong: t("skills.tooLong"),
      }),
    [t],
  );

  const form = useForm<AddTagFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "" },
  });

  const { reset } = form;

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: AddTagFormValues) => {
    startTransition(async () => {
      const result = await createTag(values.label);
      if (result?.success) {
        toastSuccess(t("skills.added"));
        setDialogOpen(false);
        reset();
        reloadTags();
      } else {
        toastError(result?.message ?? t("skills.addFailed"));
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
          {t("skills.newSkill")}
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.addTitle")}</DialogTitle>
            <DialogDescription>
              {t("skills.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("skills.nameLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("skills.namePlaceholder")} {...field} />
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

export default AddTag;
