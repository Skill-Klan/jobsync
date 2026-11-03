"use client";
import React from "react";
import { useLocale, useTranslations } from "@/i18n/client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FormControl } from "./ui/form";
import { ControllerRenderProps } from "react-hook-form";

interface SelectProps {
  label: string;
  options: any[];
  field: ControllerRenderProps<any, any>;
  // Adds a "Not selected" entry that clears the field (the value becomes "",
  // not undefined: react-hook-form turns undefined back into the field's
  // default). Radix items cannot have an empty value, hence the sentinel.
  clearable?: boolean;
}

const NONE = "__none__";

function SelectFormCtrl({ label, options, field, clearable }: SelectProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const prompt = t("select.placeholder", { item: label });
  return (
    <>
      <Select
        onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
        value={field.value || (clearable ? NONE : undefined)}
        name={field.name}
      >
        <FormControl>
          <SelectTrigger
            // English names the field ("Select status"); in Ukrainian the noun
            // would need declining, so the visible form label names it instead.
            aria-label={locale === "en" ? prompt : undefined}
            className="w-[200px] [&_[data-incomplete-hint]]:pointer-events-none"
          >
            <SelectValue placeholder={prompt} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectGroup>
            {clearable && <SelectItem value={NONE}>{t("select.none")}</SelectItem>}
            {options &&
              options.map((option) => {
                return (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    disabled={option.disabled}
                  >
                    {option.label ?? option.value ?? option.title}
                    {option.suffix}
                  </SelectItem>
                );
              })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

export default SelectFormCtrl;
