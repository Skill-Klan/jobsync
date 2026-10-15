"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { WizardResume } from "./wizardConfig";
import Link from "next/link";
import { hasMinResumeSections } from "@/lib/resumeSections";
import { APP_CONSTANTS } from "@/lib/constants";
import { IncompleteResumeHint } from "@/components/IncompleteResumeHint";
import { useTranslations } from "@/i18n/client";

export function StepResume({
  form,
  resumes,
}: {
  form: UseFormReturn<CreateAutomationInput>;
  resumes: WizardResume[];
}) {
  const t = useTranslations("automations");
  const selectableCount = resumes.filter((r) =>
    hasMinResumeSections(r.sectionCount),
  ).length;
  const incompleteCount = resumes.length - selectableCount;
  const min = APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;

  return (
    <>
      <FormField
        control={form.control}
        name="resumeId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("wizard.resume.label")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="[&_[data-incomplete-hint]]:pointer-events-none">
                  <SelectValue placeholder={t("wizard.resume.placeholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {resumes.map((resume) => (
                  <SelectItem
                    key={resume.id}
                    value={resume.id}
                    disabled={!hasMinResumeSections(resume.sectionCount)}
                  >
                    {resume.title}
                    {hasMinResumeSections(resume.sectionCount) ? null : (
                      <IncompleteResumeHint />
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              {t("wizard.resume.hint")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {resumes.length === 0 && (
        <p className="text-sm text-orange-600 dark:text-orange-500">
          {t("wizard.resume.noResumes")}
        </p>
      )}
      {resumes.length > 0 && incompleteCount > 0 && (
        <p className="text-sm text-orange-600 dark:text-orange-500">
          {incompleteCount === resumes.length
            ? t("wizard.resume.noneUsable")
            : t("wizard.resume.someUnusable", { count: incompleteCount })}{" "}
          {t.rich("wizard.resume.needsSections", {
            min,
            profile: (chunks) => (
              <Link href="/dashboard/profile" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </>
  );
}
