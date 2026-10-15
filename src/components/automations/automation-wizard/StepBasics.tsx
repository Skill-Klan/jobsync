"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import { useTranslations } from "@/i18n/client";

export function StepBasics({
  form,
}: {
  form: UseFormReturn<CreateAutomationInput>;
}) {
  const t = useTranslations("automations");
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("wizard.basics.nameLabel")}</FormLabel>
            <FormControl>
              <Input
                placeholder={t("wizard.basics.namePlaceholder")}
                {...field}
              />
            </FormControl>
            <FormDescription>
              {t("wizard.basics.nameHint")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobBoard"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("shared.jobBoard")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t("wizard.basics.boardPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="greenhouse">
                  {t("wizard.basics.boardOption", { board: "Greenhouse" })}
                </SelectItem>
                <SelectItem value="lever">
                  {t("wizard.basics.boardOption", { board: "Lever" })}
                </SelectItem>
                <SelectItem value="ashby">
                  {t("wizard.basics.boardOption", { board: "Ashby" })}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              {t("wizard.basics.boardHint")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
