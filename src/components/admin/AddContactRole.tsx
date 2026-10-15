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
import { toastActionResult } from "@/lib/toast";
import { createContactRole } from "@/actions/contactRole.actions";
import { useTranslations } from "@/i18n/client";

// Built per render language: the messages are what the form shows.
const addContactRoleFormSchema = (m: {
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

type AddContactRoleFormValues = z.infer<
  ReturnType<typeof addContactRoleFormSchema>
>;

type AddContactRoleProps = {
  reloadRoles: () => void;
};

function AddContactRole({ reloadRoles }: AddContactRoleProps) {
  const t = useTranslations("library");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const schema = useMemo(
    () =>
      addContactRoleFormSchema({
        required: t("roles.required"),
        empty: t("roles.empty"),
        tooLong: t("roles.tooLong"),
      }),
    [t],
  );

  const form = useForm<AddContactRoleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "" },
  });

  const { reset } = form;

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: AddContactRoleFormValues) => {
    startTransition(async () => {
      const res = await createContactRole(values.label);
      toastActionResult(res, {
        success: t("roles.added"),
        onSuccess: () => {
          setDialogOpen(false);
          reset();
          reloadRoles();
        },
      });
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
          {t("roles.newRole")}
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("roles.addTitle")}</DialogTitle>
            <DialogDescription>
              {t("roles.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("roles.nameLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("roles.namePlaceholder")} {...field} />
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

export default AddContactRole;
