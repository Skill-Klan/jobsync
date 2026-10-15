"use client";
import { useCallback, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddContact from "@/components/AddContact";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllContactRoles } from "@/actions/contactRole.actions";
import type { ContactRole } from "@/models/contact.model";
import type { Company, JobLocation } from "@/models/job.model";
import { useTranslations } from "@/i18n/client";
import { QUICK_ACTION_BUTTON, QUICK_ACTION_LABEL } from "./quickActionStyles";

export default function AddContactShortcut() {
  const t = useTranslations("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<JobLocation[]>([]);
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [pickersLoading, setPickersLoading] = useState(false);
  const pickersRequested = useRef(false);

  // Most visits never open the dialog, so its three option lists wait for it
  const openDialog = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open || pickersRequested.current) return;
    pickersRequested.current = true;
    setPickersLoading(true);
    Promise.all([getAllCompanies(), getAllJobLocations(), getAllContactRoles()])
      .then(([companyList, locationList, roleList]) => {
        if (Array.isArray(companyList)) setCompanies(companyList);
        if (Array.isArray(locationList)) setLocations(locationList);
        if (Array.isArray(roleList)) setRoles(roleList);
      })
      .finally(() => setPickersLoading(false));
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className={QUICK_ACTION_BUTTON}
        onClick={() => openDialog(true)}
      >
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className={QUICK_ACTION_LABEL}>{t("quickActions.addContact")}</span>
      </Button>
      <AddContact
        hideTrigger
        dialogOpen={dialogOpen}
        setDialogOpen={openDialog}
        pickersLoading={pickersLoading}
        companies={companies}
        locations={locations}
        roles={roles}
        reloadContacts={() => {}}
        resetEditContact={() => {}}
      />
    </>
  );
}
