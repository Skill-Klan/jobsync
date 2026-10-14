"use client";
import { AddCertificationFormSchema } from "@/models/addCertificationForm.schema";
import { LicenseOrCertification, ResumeSection } from "@/models/profile.model";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FormDialogFooter } from "../FormDialogFooter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { DatePicker } from "../DatePicker";
import { Switch } from "../ui/switch";
import { useEffect, useTransition } from "react";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  addCertification,
  updateCertification,
} from "@/actions/profile.actions";
import { useTranslations } from "@/i18n/client";

type AddCertificationProps = {
  resumeId: string | undefined;
  sectionId: string | undefined;
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
  certificationToEdit?: ResumeSection;
};

function AddCertification({
  resumeId,
  sectionId,
  dialogOpen,
  setDialogOpen,
  certificationToEdit,
}: AddCertificationProps) {
  const t = useTranslations("profile");
  const pageTitle = certificationToEdit
    ? t("certification.editTitle")
    : t("certification.addTitle");
  const pageDescription = certificationToEdit
    ? t("certification.editDescription")
    : t("certification.addDescription");
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof AddCertificationFormSchema>>({
    resolver: zodResolver(AddCertificationFormSchema),
    defaultValues: {
      resumeId,
      sectionId,
      noExpiration: false,
    },
  });

  const { watch, reset, formState, resetField } = form;
  const noExpirationValue = watch("noExpiration");

  useEffect(() => {
    if (certificationToEdit) {
      const cert: LicenseOrCertification =
        certificationToEdit?.licenseOrCertifications?.at(0)!;
      reset(
        {
          id: cert?.id,
          title: cert?.title,
          organization: cert?.organization,
          issueDate: cert?.issueDate ? new Date(cert.issueDate) : undefined,
          expirationDate: cert?.expirationDate
            ? new Date(cert.expirationDate)
            : undefined,
          credentialUrl: cert?.credentialUrl ?? "",
          noExpiration: !cert?.expirationDate,
        },
        { keepDefaultValues: true },
      );
    } else {
      reset(
        {
          resumeId,
          sectionId,
        },
        { keepDefaultValues: true },
      );
    }
  }, [certificationToEdit, resumeId, sectionId, reset]);

  const onNoExpirationChange = (checked: boolean) => {
    if (checked) {
      resetField("expirationDate");
    }
  };

  const onSubmit = (data: z.infer<typeof AddCertificationFormSchema>) => {
    startTransition(async () => {
      const res = certificationToEdit?.licenseOrCertifications?.length
        ? await updateCertification(data)
        : await addCertification(data);
      if (!res.success) {
        toastError(res.message);
      } else {
        reset();
        setDialogOpen(false);
        toastSuccess(
          certificationToEdit
            ? t("certification.updated")
            : t("certification.added"),
        );
      }
    });
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="h-full md:h-[85%] lg:max-h-screen md:max-w-[40rem] overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
          <DialogDescription>{pageDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
          >
            {/* SECTION TITLE */}
            {!sectionId && (
              <>
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="sectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("sections.sectionTitle")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            placeholder={t("certification.sectionTitlePlaceholder")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <hr className="md:col-span-2" />
              </>
            )}

            {/* CERTIFICATION TITLE */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("certification.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t("placeholders.ex", {
                          example: "AWS Certified Solutions Architect",
                        })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ORGANIZATION */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("certification.organization")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t("placeholders.ex", {
                          example: "Amazon Web Services",
                        })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ISSUE DATE */}
            <div className="flex flex-col">
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("certification.issueDate")}</FormLabel>
                    <DatePicker
                      field={field}
                      presets={false}
                      isEnabled={true}
                      captionLayout={true}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* EXPIRATION DATE */}
            <div className="flex flex-col">
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("certification.expirationDate")}</FormLabel>
                    <DatePicker
                      field={field}
                      presets={false}
                      isEnabled={!noExpirationValue}
                      captionLayout={true}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* NO EXPIRATION */}
            <div className="flex items-center">
              <FormField
                control={form.control}
                name="noExpiration"
                render={({ field }) => (
                  <FormItem className="flex flex-row">
                    <Switch
                      checked={field.value}
                      onCheckedChange={(c) => {
                        field.onChange(c);
                        onNoExpirationChange(c);
                      }}
                    />
                    <FormLabel className="flex items-center ml-4 mb-2">
                      {field.value
                        ? t("certification.noExpiration")
                        : t("certification.hasExpiration")}
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CREDENTIAL URL */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="credentialUrl"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("certification.credentialUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="https://www.credly.com/badges/..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormDialogFooter
              onCancel={closeDialog}
              isPending={isPending}
              saveDisabled={!formState.isDirty}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddCertification;
