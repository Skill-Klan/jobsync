"use client";

import type { UseFormReturn } from "react-hook-form";
import { Slider } from "@/components/ui/slider";
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

export function StepMatching({
  form,
}: {
  form: UseFormReturn<CreateAutomationInput>;
}) {
  const t = useTranslations("automations");
  return (
    <FormField
      control={form.control}
      name="matchThreshold"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t("wizard.matching.label", { value: field.value })}
          </FormLabel>
          <FormControl>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[field.value]}
              onValueChange={(value) => field.onChange(value[0])}
            />
          </FormControl>
          <FormDescription>
            {t("wizard.matching.hint")}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
