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
}

function SelectFormCtrl({ label, options, field }: SelectProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const prompt = t("select.placeholder", { item: label });
  return (
    <>
      <Select
        onValueChange={field.onChange}
        value={field.value}
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
