"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import AddCompany from "./AddCompany";
import {
  deleteCompanyById,
  setCompanyWatched,
} from "@/actions/company.actions";
import { toastError, toastSuccess } from "@/lib/toast";
import { AlertDialog } from "@/models/alertDialog.model";
import type { CompanyDetails as CompanyDetailsData } from "@/models/companyDetails.model";
import type { Company } from "@/models/job.model";
import { CompanyDetailsHeader } from "./company-details/CompanyDetailsHeader";
import { CompanySummaryCard } from "./company-details/CompanySummaryCard";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import { CompanyJobsTab } from "./company-details/CompanyJobsTab";
import { CompanyContactsTab } from "./company-details/CompanyContactsTab";
import { useTranslations } from "@/i18n/client";

const LIBRARY_COMPANIES = "/dashboard/admin?tab=companies";
const COMPANY_DETAIL_TABS = ["jobs", "contacts"] as const;

type CompanyDetailsProps = {
  details: CompanyDetailsData;
};

function CompanyDetails({ details }: CompanyDetailsProps) {
  const t = useTranslations("library");
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref =
    searchParams.get("scope") === "watchlist"
      ? `${LIBRARY_COMPANIES}&scope=watchlist`
      : LIBRARY_COMPANIES;
  const goBack = () => router.back();
  const [activeTab, handleTabChange] = useTabQueryParam(
    COMPANY_DETAIL_TABS,
    "jobs",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const { jobs, dismissedJobsCount, currentContacts, formerContacts } = details;
  const contactsCount = new Set(
    [...currentContacts, ...formerContacts].map((contact) => contact.id),
  ).size;

  const toggleWatch = async () => {
    const next = !details.watched;
    const res = await setCompanyWatched(details.id, next);
    if (res.success) {
      toastSuccess(
        next
          ? t("companies.added", { name: details.label })
          : t("companies.removedStays", { name: details.label }),
      );
      router.refresh();
    } else {
      toastError(res.message);
    }
  };

  // AddCompany refills its form only when editCompany changes identity, so
  // a fresh copy per open discards an abandoned edit
  const openEdit = () => {
    setEditTarget({ ...details });
    setEditOpen(true);
  };

  // Jobs block up front, dismissed ones included, because the server guard
  // counts them; contacts and resume entries are left to the server message.
  const onDelete = () => {
    const total = jobs.length + dismissedJobsCount;
    if (total > 0) {
      setAlert({
        openState: true,
        deleteAction: false,
        title: t("shared.associatedJobs"),
        description: [
          t("companies.blockedJobs", { count: total }),
          dismissedJobsCount > 0
            ? t("companies.blockedDismissed", { count: dismissedJobsCount })
            : null,
          t("companies.blockedTail"),
        ]
          .filter(Boolean)
          .join(" "),
      });
    } else {
      setAlert({ openState: true, deleteAction: true, itemId: details.id });
    }
  };

  const deleteCompany = async () => {
    const { success, message } = await deleteCompanyById(details.id);
    if (success) {
      toastSuccess(t("companies.deleted"));
      router.push(backHref);
    } else {
      toastError(message);
    }
  };

  return (
    <>
      <div className="py-6 space-y-6">
        <CompanyDetailsHeader
          company={details}
          onBack={goBack}
          onToggleWatch={toggleWatch}
          onEdit={openEdit}
          onDelete={onDelete}
        />

        <CompanySummaryCard
          company={details}
          jobsCount={jobs.length}
          appliedCount={details.appliedCount}
          contactsCount={contactsCount}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="jobs">
              {t("companyDetails.jobsTab")}
              {jobs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {jobs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacts">
              {t("companyDetails.contactsTab")}
              {contactsCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {contactsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="jobs" className="mt-4">
            <Card className="p-6">
              <CompanyJobsTab jobs={jobs} />
            </Card>
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            <Card className="p-6">
              <CompanyContactsTab
                companyId={details.id}
                currentContacts={currentContacts}
                formerContacts={formerContacts}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <AddCompany
        hideTrigger
        editCompany={editTarget}
        reloadCompanies={() => router.refresh()}
        resetEditCompany={() => {}}
        dialogOpen={editOpen}
        setDialogOpen={setEditOpen}
      />
      <DeleteAlertDialog
        pageTitle={t("companies.deleteItem")}
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={deleteCompany}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default CompanyDetails;
