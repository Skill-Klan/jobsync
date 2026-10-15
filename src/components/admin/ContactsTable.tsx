"use client";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import ContactRow from "./ContactRow";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { deleteContactById } from "@/actions/contact.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { AlertDialog } from "@/models/alertDialog.model";
import type { Contact } from "@/models/contact.model";
import { useTranslations } from "@/i18n/client";

type ContactsTableProps = {
  contacts: Contact[];
  reloadContacts: () => void;
  editContact: (id: string) => void;
  hideCompanyColumn?: boolean;
};

function ContactsTable({
  contacts,
  reloadContacts,
  editContact,
  hideCompanyColumn,
}: ContactsTableProps) {
  const t = useTranslations("library");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  // A link is meaningless without the person and JobContact cascades from
  // contactId, so the dialog warns about the links rather than blocking.
  const onDeleteContact = (contact: Contact) => {
    const jobs = contact._count?.jobLinks ?? 0;
    setAlert({
      openState: true,
      deleteAction: true,
      itemId: contact.id,
      title: jobs > 0 ? t("contacts.deleteTitle") : undefined,
      description:
        jobs > 0
          ? t("contacts.deleteLinked", { name: contact.name, count: jobs })
          : undefined,
    });
  };

  const deleteContact = async (contactId: string | undefined) => {
    if (contactId) {
      const { success, message } = await deleteContactById(contactId);
      if (success) {
        toastSuccess(t("contacts.deleted"));
        reloadContacts();
      } else {
        toastError(message);
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">{t("contacts.expand")}</span>
            </TableHead>
            <TableHead>{t("contacts.name")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("contacts.jobTitle")}</TableHead>
            {!hideCompanyColumn && <TableHead>{t("contacts.company")}</TableHead>}
            <TableHead>{t("contacts.roles")}</TableHead>
            <TableHead>{t("contacts.jobs")}</TableHead>
            <TableHead>{t("contacts.lastContacted")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("shared.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact: Contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              expanded={expandedId === contact.id}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === contact.id ? null : contact.id,
                )
              }
              onEdit={() => editContact(contact.id)}
              onDelete={() => onDeleteContact(contact)}
              hideCompanyColumn={hideCompanyColumn}
            />
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle={t("contacts.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteContact(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ContactsTable;
