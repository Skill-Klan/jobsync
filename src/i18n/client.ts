"use client";
import { useLocale } from "use-intl";
import { isLocale, DEFAULT_LOCALE } from "./config";
import { dateFnsLocale } from "./dateFns";

// Client components take their hooks from here, not from "use-intl" directly:
// one import point to change, and one place the test setup replaces.
export { useFormatter, useLocale, useTranslations } from "use-intl";

export function useDateFnsLocale() {
  const locale = useLocale();
  return dateFnsLocale(isLocale(locale) ? locale : DEFAULT_LOCALE);
}
