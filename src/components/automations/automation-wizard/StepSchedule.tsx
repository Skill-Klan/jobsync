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
import { HOURS } from "./wizardConfig";
import { useTranslations } from "@/i18n/client";

export function StepSchedule({
  form,
  takenHours,
}: {
  form: UseFormReturn<CreateAutomationInput>;
  takenHours: Set<number>;
}) {
  const t = useTranslations("automations");
  return (
    <FormField
      control={form.control}
      name="scheduleHour"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("wizard.schedule.label")}</FormLabel>
          <Select
            onValueChange={(val) => {
              field.onChange(parseInt(val));
              form.clearErrors("scheduleHour");
            }}
            value={field.value.toString()}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={t("wizard.schedule.placeholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour.value} value={hour.value.toString()}>
                  {hour.label}
                  {takenHours.has(hour.value) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("wizard.schedule.inUse")}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            {t("wizard.schedule.hint")}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
