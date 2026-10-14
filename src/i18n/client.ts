"use client";
import { useLocale, useTranslations } from "use-intl";
import { isLocale, DEFAULT_LOCALE, type Locale } from "./config";
import { dateFnsLocale } from "./dateFns";
import { formatDate, type DatePattern } from "./dates";
import { labelFor, type LabelKind, type LabelsTranslator } from "./labels";

// Client components take their hooks from here, not from "use-intl" directly:
// one import point to change, and one place the test setup replaces.
export { useFormatter, useLocale, useTranslations } from "use-intl";

export function useDateFnsLocale() {
  return dateFnsLocale(useAppLocale());
}

function useAppLocale(): Locale {
  const locale = useLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** (date, DATE_PATTERNS.x) → the date in the user's language. */
export function useFormatDate() {
  const locale = useAppLocale();
  return (date: Date | number, pattern: DatePattern) => formatDate(date, pattern, locale);
}

/** (kind, { value, label }) → a stored status/stage/role/source in the user's language (src/i18n/labels.ts). */
export function useLabel() {
  const t = useTranslations("labels") as unknown as LabelsTranslator;
  return (kind: LabelKind, item: { value: string; label?: string | null }) => labelFor(t, kind, item);
}
