"use client";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ComboBox";
import AddContact from "@/components/AddContact";
import { toastActionResult } from "@/lib/toast";
import { addJobContact } from "@/actions/contact.actions";
import type { ContactRef, ContactRole } from "@/models/contact.model";
import type { Company, JobLocation } from "@/models/job.model";
import { useLabel, useTranslations } from "@/i18n/client";

const linkContactSchema = (messages: { contact: string; role: string }) =>
  z.object({
    contact: z.string().min(1, messages.contact),
    contactRole: z.string().min(1, messages.role),
  });

type LinkContactValues = z.infer<ReturnType<typeof linkContactSchema>>;

type AddJobContactFormProps = {
  jobId: string;
  contacts: ContactRef[];
  roles: ContactRole[];
  companies: Company[];
  locations: JobLocation[];
  onCancel: () => void;
  onLinked: () => void;
  onContactCreated: (contact: ContactRef) => void;
};

export function AddJobContactForm({
  jobId,
  contacts,
  roles,
  companies,
  locations,
  onCancel,
  onLinked,
  onContactCreated,
}: AddJobContactFormProps) {
  const t = useTranslations("jobs");
  const label = useLabel();
  const [isPending, startTransition] = useTransition();
  const [newContactOpen, setNewContactOpen] = useState(false);
  const schema = useMemo(
    () =>
      linkContactSchema({
        contact: t("contacts.pickContact"),
        role: t("contacts.pickRole"),
      }),
    [t],
  );
  // Seeded roles are stored in English; the picker shows them in the user's language.
  const roleOptions = roles.map((role) => ({
    ...role,
    label: label("contactRole", role),
  }));
  // What the contact picker's search box holds, so "New contact" can carry it
  const [typedName, setTypedName] = useState("");

  const form = useForm<LinkContactValues>({
    resolver: zodResolver(schema),
    defaultValues: { contact: "", contactRole: "" },
  });

  const onSubmit = (values: LinkContactValues) => {
    startTransition(async () => {
      const res = await addJobContact(jobId, values.contact, values.contactRole);
      toastActionResult(res, {
        success: t("contacts.linked"),
        onSuccess: () => {
          form.reset();
          onLinked();
        },
      });
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-3"
      >
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t("contacts.contact")}</FormLabel>
              <Combobox
                options={contacts}
                field={field}
                label="contact"
                onSearchChange={setTypedName}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactRole"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t("contacts.role")}</FormLabel>
              <Combobox
                options={roleOptions}
                field={field}
                creatable
                label="role"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="cursor-pointer" disabled={isPending}>
          {t("ui.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={onCancel}
        >
          {t("ui.cancel")}
        </Button>
        <Button
          type="button"
          variant="link"
          className="cursor-pointer"
          onClick={() => setNewContactOpen(true)}
        >
          {t("contacts.newContact")}
        </Button>
      </form>

      {/* A contact has a dozen fields, so the picker has no creatable path:
          the typed name carries into the full dialog instead. */}
      <AddContact
        hideTrigger
        prefillName={typedName}
        dialogOpen={newContactOpen}
        setDialogOpen={setNewContactOpen}
        companies={companies}
        locations={locations}
        roles={roles}
        reloadContacts={() => {}}
        resetEditContact={() => {}}
        onSaved={(contact) => {
          onContactCreated(contact);
          form.setValue("contact", contact.id);
        }}
      />
    </Form>
  );
}
